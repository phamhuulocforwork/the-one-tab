import type { UserInfo, AuthState } from "../types";
import { authenticateWithGitHub } from "./oauth";
import { getUserInfo, testGitHubToken } from "./github";
import { getSettings, saveSettings } from "./storage";

// Auth state
let isSignedIn = false;
let login = "";
let userInfo: UserInfo | null = null;
let token: string | undefined = undefined;

// Flag to prevent storage listener from triggering when auth service updates token
let isUpdatingToken = false;

// Listeners for auth state changes
type AuthStateListener = (state: AuthState) => void;
const authStateListeners = new Set<AuthStateListener>();

function notifyListeners() {
  const state: AuthState = {
    isSignedIn,
    login,
    userInfo,
    token,
  };
  authStateListeners.forEach((listener) => listener(state));
}

export function getAuthState(): AuthState {
  return {
    isSignedIn,
    login,
    userInfo,
    token,
  };
}

export function onAuthStateChange(listener: AuthStateListener): () => void {
  authStateListeners.add(listener);
  // Immediately call with current state
  listener(getAuthState());
  // Return unsubscribe function
  return () => {
    authStateListeners.delete(listener);
  };
}

async function markUserAsSignedIn(
  newToken: string,
  newUserInfo: UserInfo,
  refreshUI: boolean = true,
) {
  // Set flag FIRST to prevent storage listener from triggering
  isUpdatingToken = true;

  try {
    // Update in-memory state first
    token = newToken;
    isSignedIn = true;
    login = newUserInfo.login;
    userInfo = newUserInfo;

    // Only save to storage if token changed (to avoid unnecessary storage events)
    const settings = await getSettings();
    if (settings.oauthToken !== newToken) {
      await saveSettings({
        ...settings,
        oauthToken: newToken,
      });
      // Wait a bit to ensure storage change propagates
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    // Reset flag after delay to allow storage change to fully propagate
    setTimeout(() => {
      isUpdatingToken = false;
    }, 200);
  }

  if (refreshUI) {
    notifyListeners();
  }
}

function markUserAsSignedOut() {
  token = undefined;
  isSignedIn = false;
  login = "";
  userInfo = null;
  notifyListeners();
}

export async function getToken(): Promise<string | undefined> {
  return token;
}

export function getCurrentUser(): string {
  return login;
}

export async function ensureAuthenticated(): Promise<void> {
  if (isSignedIn && token) {
    // Verify token is still valid
    try {
      const isValid = await testGitHubToken(token);
      if (isValid) {
        return;
      }
      // Token is invalid, sign out
      await signOut();
    } catch {
      // Token validation failed, sign out
      await signOut();
    }
  }

  // Not authenticated, throw error
  throw new Error(
    "Bạn cần đăng nhập với GitHub để thực hiện thao tác này. Vui lòng mở Options page và đăng nhập.",
  );
}

export async function signIn(): Promise<boolean> {
  const settings = await getSettings();

  if (!settings.githubClientId) {
    throw new Error("Vui lòng nhập GitHub OAuth App Client ID trong Settings trước");
  }

  if (!settings.githubClientSecret) {
    throw new Error("Vui lòng nhập GitHub OAuth App Client Secret trong Settings trước");
  }

  try {
    // Use existing OAuth flow
    const accessToken = await authenticateWithGitHub(
      settings.githubClientId,
      settings.githubClientSecret,
    );

    // Get user info
    const user = await getUserInfo(accessToken);

    // Mark as signed in
    await markUserAsSignedIn(accessToken, user, true);

    console.log("[Auth] Successfully signed in as:", user.login);
    return true;
  } catch (error) {
    console.error("[Auth] Sign in error:", error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  // Set flag FIRST to prevent storage listener from triggering
  isUpdatingToken = true;

  try {
    // Clear token from settings
    const settings = await getSettings();
    await saveSettings({
      ...settings,
      oauthToken: undefined,
    });

    // Wait a bit to ensure storage change propagates
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    // Reset flag after delay
    setTimeout(() => {
      isUpdatingToken = false;
    }, 200);
  }

  markUserAsSignedOut();
  console.log("[Auth] Signed out");
}

/**
 * Retry a function with auto re-authentication on 401 errors
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 1)
 * @returns Result of the function
 */
export async function withRetryOn401<T>(
  fn: (token: string) => Promise<T>,
  maxRetries: number = 1,
): Promise<T> {
  let currentToken = token;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      if (!currentToken) {
        await ensureAuthenticated();
        currentToken = token;
        if (!currentToken) {
          throw new Error("Không thể lấy token sau khi đăng nhập");
        }
      }

      return await fn(currentToken);
    } catch (error) {
      const errorMsg = (error as Error).message;
      const is401Error =
        errorMsg.includes("401") ||
        errorMsg.includes("hết hạn") ||
        errorMsg.includes("Bad credentials") ||
        errorMsg.includes("Unauthorized");

      if (is401Error && retryCount < maxRetries) {
        console.log(
          `[Auth] 401 error detected, attempting re-authentication (retry ${retryCount + 1}/${maxRetries})`,
        );

        // Sign out first
        await signOut();

        // Try to sign in again if credentials are available
        try {
          const settings = await getSettings();
          if (settings.githubClientId && settings.githubClientSecret) {
            console.log("[Auth] Auto re-authenticating...");
            const success = await signIn();
            if (success) {
              currentToken = token;
              retryCount++;
              continue; // Retry the operation
            }
          }
        } catch (reAuthError) {
          console.error("[Auth] Re-authentication failed:", reAuthError);
        }

        // If re-auth failed or no credentials, throw original error
        throw new Error(
          `Token đã hết hạn và không thể tự động đăng nhập lại.\n` +
            `Vui lòng mở Options page và đăng nhập lại.\n\n` +
            `Lỗi gốc: ${errorMsg}`,
        );
      }

      // Not a 401 error or max retries reached, throw original error
      throw error;
    }
  }

  throw new Error("Đã vượt quá số lần thử lại");
}

async function attemptSilentSignin(refreshUI: boolean = true): Promise<void> {
  const settings = await getSettings();
  const storedToken = settings.oauthToken;

  if (!storedToken) {
    if (isSignedIn) {
      markUserAsSignedOut();
    }
    return;
  }

  // If we're already signed in with the same token, skip validation
  if (isSignedIn && token === storedToken) {
    console.log("[Auth] Already signed in with same token, skipping silent sign-in");
    return;
  }

  try {
    // Validate token
    const isValid = await testGitHubToken(storedToken);
    if (!isValid) {
      if (isSignedIn) {
        markUserAsSignedOut();
      }
      return;
    }

    // Get user info
    const user = await getUserInfo(storedToken);

    // Mark as signed in (this will update token in memory and storage)
    // Use refreshUI=false to avoid triggering listeners unnecessarily
    await markUserAsSignedIn(storedToken, user, refreshUI);
    console.log("[Auth] Silent sign-in successful:", user.login);
  } catch (error) {
    console.error("[Auth] Silent sign-in failed:", error);
    if (isSignedIn) {
      markUserAsSignedOut();
    }
  }
}

// Flag to track if auth has been initialized
let authInitialized = false;
let restorePromise: Promise<void> | null = null;

export async function restoreAuthState(): Promise<void> {
  // If already initialized and signed in, skip
  if (authInitialized && isSignedIn && token) {
    return;
  }

  // If restore is already in progress, wait for it
  if (restorePromise) {
    return restorePromise;
  }

  // Attempt silent sign-in to restore state
  restorePromise = attemptSilentSignin(true)
    .then(() => {
      authInitialized = true;
      restorePromise = null;
    })
    .catch((error) => {
      authInitialized = true;
      restorePromise = null;
      throw error;
    });

  return restorePromise;
}

export async function initializeAuth(): Promise<void> {
  console.log("[Auth] Initializing auth system...");

  // Attempt silent sign-in on initialization
  await attemptSilentSignin(true);
  authInitialized = true;

  // Listen to storage changes to sync auth state
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      // Skip if auth service is currently updating token
      if (isUpdatingToken) {
        console.log("[Auth] Skipping storage listener - token update in progress");
        return;
      }

      // Check if oauthToken changed
      const storageDataKey = "tabManagerData";
      if (changes[storageDataKey]) {
        const newValue = changes[storageDataKey].newValue;
        const oldValue = changes[storageDataKey].oldValue;
        const newToken = newValue?.settings?.oauthToken;
        const oldToken = oldValue?.settings?.oauthToken;

        // Only sync if:
        // 1. Token actually changed
        // 2. New token is different from current in-memory token
        // 3. We're not already signed in with this token
        if (newToken !== oldToken) {
          if (newToken === token && isSignedIn) {
            // Token matches current state, no need to sync
            console.log("[Auth] Token matches current state, skipping sync");
            return;
          }

          if (newToken && newToken !== token) {
            // Token changed externally, attempt silent sign-in
            console.log("[Auth] Token changed externally, attempting silent sign-in");
            attemptSilentSignin(true).catch((error) => {
              console.error("[Auth] Error syncing auth state:", error);
            });
          } else if (!newToken && isSignedIn) {
            // Token was removed externally, sign out
            console.log("[Auth] Token removed externally, signing out");
            markUserAsSignedOut();
          }
        }
      }
    }
  });
}
