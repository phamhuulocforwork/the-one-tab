import type { StorageData, UserInfo } from "../types";
import { getStorageDataForSync, setStorageDataFromSync } from "./storage";
import { withRetryOn401, getToken } from "./auth";

const GITHUB_API_BASE = "https://api.github.com";
const GIST_FILENAME = "the-one-tab-data.json";

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

// Use "token" format for all tokens. Some GitHub endpoints (e.g. Gist GET/PATCH)
// may reject "Bearer" for OAuth app tokens (gho_) with 401.
function getAuthHeader(token: string): string {
  return `token ${token}`;
}

function getGitHubHeaders(token: string): Record<string, string> {
  return {
    Authorization: getAuthHeader(token),
    Accept: GITHUB_ACCEPT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "The-One-Tab-Extension",
  };
}

export async function testGitHubToken(token: string): Promise<boolean> {
  try {
    // First, try to get user info to verify token
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    });

    if (!response.ok) {
      let errorMsg = "";
      let errorDetails = "";

      // Try to parse error response
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData, null, 2);

        if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
      } catch {
        // If can't parse JSON, use status text
        errorMsg = response.statusText;
      }

      // Check response status
      if (response.status === 401) {
        throw new Error(
          `Token không hợp lệ hoặc đã hết hạn (401 Unauthorized).\n` +
            `Chi tiết: ${errorMsg || "Vui lòng kiểm tra lại token."}\n` +
            `\nGợi ý:\n` +
            `1. Kiểm tra token có đúng format không (bắt đầu với ghp_ hoặc github_pat_)\n` +
            `2. Token có thể đã hết hạn - tạo token mới\n` +
            `3. Thử dùng Classic tokens thay vì Fine-grained tokens\n` +
            `4. Kiểm tra token có quyền truy cập Gist không`,
        );
      } else if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
        const rateLimitReset = response.headers.get("x-ratelimit-reset");

        if (rateLimitRemaining === "0") {
          const resetTime = rateLimitReset
            ? new Date(parseInt(rateLimitReset) * 1000).toLocaleString()
            : "sau một lúc";
          throw new Error(
            `Đã vượt quá rate limit của GitHub API.\n` + `Vui lòng thử lại ${resetTime}.`,
          );
        }

        throw new Error(
          `Token không có quyền truy cập (403 Forbidden).\n` +
            `Chi tiết: ${errorMsg || "Token có thể thiếu permissions."}\n` +
            `\nGợi ý:\n` +
            `1. Kiểm tra token có quyền "gist" không\n` +
            `2. Nếu dùng Fine-grained token, kiểm tra organization policy\n` +
            `3. Thử tạo Classic token với scope "gist"`,
        );
      }

      throw new Error(
        `Lỗi khi kiểm tra token (HTTP ${response.status}): ${errorMsg || response.statusText}\n` +
          `Chi tiết: ${errorDetails || "Không có thông tin thêm"}`,
      );
    }

    const user = await response.json();

    // Token is valid if we can get user info
    // Don't test /gists endpoint here as it may fail for other reasons
    // (e.g., no gists exist yet, permissions, etc.)
    // The actual Gist operations will validate permissions when needed

    return !!user.login;
  } catch (error) {
    console.error("Error testing GitHub token:", error);
    throw error;
  }
}

export async function getUserInfo(token: string): Promise<UserInfo> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    });

    if (!response.ok) {
      let errorMsg = "";
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.error || response.statusText;
      } catch {
        errorMsg = response.statusText;
      }

      if (response.status === 401) {
        throw new Error(`Token không hợp lệ hoặc đã hết hạn (401). ${errorMsg}`);
      } else if (response.status === 403) {
        throw new Error(`Token không có quyền truy cập (403). ${errorMsg}`);
      }

      throw new Error(`Failed to get user info (HTTP ${response.status}): ${errorMsg}`);
    }

    const user = await response.json();
    return {
      login: user.login,
      id: user.id,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    throw error;
  }
}

/**
 * Create Gist with auto retry on 401 errors
 * Uses auth service to get token and retry with re-authentication
 */
export async function createGistWithRetry(): Promise<string> {
  return withRetryOn401(async (token) => {
    return createGist(token);
  });
}

export async function createGist(token: string): Promise<string> {
  const data = await getStorageDataForSync();
  const content = JSON.stringify(data, null, 2);

  console.log("[GitHub] Creating Gist with token:", token.substring(0, 10) + "...");

  const response = await fetch(`${GITHUB_API_BASE}/gists`, {
    method: "POST",
    headers: {
      ...getGitHubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: "The One Tab - Tab Manager Extension Data",
      public: true,
      files: {
        [GIST_FILENAME]: {
          content: content,
        },
      },
    }),
  });

  console.log("[GitHub] Create Gist response status:", response.status, response.statusText);

  if (!response.ok) {
    let errorMessage = `Failed to create Gist: ${response.statusText}`;
    let errorDetails = "";

    try {
      const error = await response.json();
      errorDetails = JSON.stringify(error, null, 2);
      if (error.message) {
        errorMessage = error.message;
      }
    } catch {
      // If error response is not JSON
    }

    if (response.status === 401) {
      throw new Error(
        `Token không hợp lệ hoặc đã hết hạn (401).\n` +
          `Chi tiết: ${errorMessage}\n` +
          `Vui lòng kiểm tra lại token hoặc tạo token mới.`,
      );
    } else if (response.status === 403) {
      throw new Error(
        `Token không có quyền tạo Gist (403).\n` +
          `Chi tiết: ${errorMessage}\n` +
          `Vui lòng đảm bảo token có quyền "gist" (Read and Write).`,
      );
    }

    throw new Error(
      `Failed to create Gist (HTTP ${response.status}): ${errorMessage}\n` +
        (errorDetails ? `Chi tiết: ${errorDetails}` : ""),
    );
  }

  const gist = await response.json();
  console.log("[GitHub] Gist created successfully:", gist.id);

  // Verify token is still valid after creating Gist by checking user endpoint
  // Don't check /gists endpoint as it may return 401 if user has no gists yet
  try {
    const verifyResponse = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    });
    console.log("[GitHub] Token verification after create (user endpoint):", verifyResponse.status);

    if (!verifyResponse.ok) {
      console.warn(
        "[GitHub] Token may have been revoked after creating Gist! Status:",
        verifyResponse.status,
      );
    } else {
      const scopes = verifyResponse.headers.get("X-OAuth-Scopes");
      console.log("[GitHub] Token is still valid after creating Gist. X-OAuth-Scopes:", scopes ?? "(none)");
    }
  } catch (verifyError) {
    console.error("[GitHub] Error verifying token after create:", verifyError);
  }

  return gist.id;
}

export async function updateGist(token: string, gistId: string, data: StorageData): Promise<void> {
  const content = JSON.stringify(data, null, 2);

  console.log("[GitHub] Updating Gist:", gistId);

  let filename = GIST_FILENAME;

  // Try to get the current Gist to preserve the filename
  // But if it fails (e.g., token doesn't have read permission), use default filename
  try {
    const getResponse = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
      headers: getGitHubHeaders(token),
    });

    console.log("[GitHub] Get Gist response status:", getResponse.status);

    if (getResponse.ok) {
      const gist = await getResponse.json();
      filename = Object.keys(gist.files)[0] || GIST_FILENAME;
      console.log("[GitHub] Gist filename:", filename);
    } else {
      // If we can't read the Gist, log warning but continue with default filename
      console.warn("[GitHub] Cannot read Gist to get filename, using default:", GIST_FILENAME);

      // If it's 401/403, token might not have read permission but might have write permission
      // We'll try to update anyway with default filename
      if (getResponse.status === 401 || getResponse.status === 403) {
        console.warn("[GitHub] Token may not have read permission, but will try to update anyway");
      } else if (getResponse.status === 404) {
        throw new Error(`Gist không tồn tại (404). Vui lòng kiểm tra lại Gist ID: ${gistId}`);
      }
    }
  } catch (error) {
    // If GET fails but it's not a 404, try to update anyway
    if ((error as Error).message.includes("404")) {
      throw error;
    }
    console.warn("[GitHub] Error getting Gist, will try to update with default filename:", error);
  }

  // Try to update Gist directly
  console.log("[GitHub] Patching Gist with filename:", filename);
  console.log("[GitHub] Authorization header for PATCH:", getAuthHeader(token).substring(0, 15) + "...");
  
  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      ...getGitHubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: "The One Tab - Tab Manager Extension Data",
      files: {
        [filename]: {
          content: content,
        },
      },
    }),
  });

  console.log("[GitHub] Update Gist response status:", response.status);
  console.log("[GitHub] PATCH response headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    let errorMessage = `Failed to update Gist: ${response.statusText}`;
    let errorDetails = "";

    try {
      const error = await response.json();
      errorDetails = JSON.stringify(error, null, 2);
      if (error.message) {
        errorMessage = error.message;
      }
    } catch {
      // If error response is not JSON
    }

    // Check for permission headers
    const acceptedPermissions = response.headers.get("X-Accepted-GitHub-Permissions");
    const requiredPermissions = response.headers.get("X-Required-GitHub-Permissions");

    if (response.status === 401 || response.status === 403) {
      let detailedMsg = `Token không thể update Gist ${gistId} (${response.status}).\n`;
      if (acceptedPermissions) {
        detailedMsg += `Permissions được chấp nhận: ${acceptedPermissions}\n`;
      }
      if (requiredPermissions) {
        detailedMsg += `Permissions yêu cầu: ${requiredPermissions}\n`;
      }
      detailedMsg += `Chi tiết: ${errorMessage}\n\n`;
      detailedMsg += `Điều này có thể do:\n`;
      detailedMsg += `1. Token chỉ có quyền create nhưng không có quyền update\n`;
      detailedMsg += `2. Classic token thiếu scope "gist" (cần cả read và write)\n`;
      detailedMsg += `3. Fine-grained token thiếu quyền update Gist\n`;
      detailedMsg += `4. Organization policy block access\n\n`;
      detailedMsg += `Giải pháp:\n`;
      detailedMsg += `- OAuth: Đăng xuất rồi đăng nhập lại (bấm Authorize trên GitHub)\n`;
      detailedMsg += `- Đảm bảo OAuth App có scope "gist" (read & write)\n`;
      detailedMsg += `- Kiểm tra organization policy nếu bạn thuộc organization`;

      throw new Error(detailedMsg);
    } else if (response.status === 404) {
      throw new Error(`Gist không tồn tại (404). Vui lòng kiểm tra lại Gist ID: ${gistId}`);
    }

    throw new Error(
      `Failed to update Gist (HTTP ${response.status}): ${errorMessage}\n` +
        (errorDetails ? `Chi tiết: ${errorDetails}` : ""),
    );
  }

  console.log("[GitHub] Gist updated successfully");
}

export async function syncToGist(token: string, gistId?: string): Promise<void> {
  const data = await getStorageDataForSync();

  console.log("[GitHub] Syncing to Gist, gistId:", gistId || "new");
  console.log("[GitHub] Using token type:", token.substring(0, 4) + "...");
  console.log("[GitHub] Authorization header:", getAuthHeader(token).substring(0, 15) + "...");

  try {
    if (gistId) {
      await updateGist(token, gistId, data);
    } else {
      const newGistId = await createGist(token);
      // Save the new Gist ID to settings
      const { saveSettings, getSettings } = await import("./storage");
      const currentSettings = await getSettings();
      await saveSettings({ ...currentSettings, gistId: newGistId });
    }
  } catch (error) {
    // Re-throw with more context
    const errorMsg = (error as Error).message;
    console.error("[GitHub] Sync error:", error);

    // Don't wrap the error if it already has detailed message
    if (
      errorMsg.includes("Permissions") ||
      errorMsg.includes("permissions") ||
      errorMsg.length > 200
    ) {
      throw error;
    }

    if (errorMsg.includes("401") || errorMsg.includes("403")) {
      throw new Error(
        `Token không thể sync Gist.\n` +
          `Chi tiết: ${errorMsg}\n\n` +
          `Điều này có thể do:\n` +
          `1. Fine-grained token thiếu quyền truy cập Gist cụ thể\n` +
          `2. Organization policy block access\n` +
          `3. Token không có quyền "gist" (Read and Write)\n\n` +
          `Giải pháp:\n` +
          `- Kiểm tra token có quyền "gist" (Read and Write) không\n` +
          `- Thử tạo Classic token với scope "gist"\n` +
          `- Kiểm tra organization policy nếu bạn thuộc organization`,
      );
    }
    throw error;
  }
}

/**
 * Sync to Gist with auto retry on 401 errors
 * Uses auth service to get token and retry with re-authentication
 */
export async function syncToGistWithRetry(gistId?: string): Promise<void> {
  return withRetryOn401(async (token) => {
    return syncToGist(token, gistId);
  });
}

export async function syncFromGist(token: string, gistId: string): Promise<StorageData> {
  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    headers: getGitHubHeaders(token),
  });

  if (!response.ok) {
    let errorMessage = `Failed to fetch Gist: ${response.statusText}`;

    // Handle specific error cases
    if (response.status === 401 || response.status === 403) {
      const oauthScopes = response.headers.get("X-OAuth-Scopes");
      const accepted = response.headers.get("X-Accepted-GitHub-Permissions");
      errorMessage =
        "Token không thể đọc Gist (401/403). Thử đăng xuất rồi đăng nhập lại OAuth.";
      if (oauthScopes) errorMessage += ` Scopes hiện tại: ${oauthScopes}.`;
      if (accepted) errorMessage += ` Yêu cầu: ${accepted}.`;
    } else if (response.status === 404) {
      errorMessage = "Gist không tồn tại. Vui lòng kiểm tra lại Gist ID.";
    } else {
      try {
        const error = await response.json();
        errorMessage = `Failed to fetch Gist: ${error.message || response.statusText}`;
      } catch {
        // If error response is not JSON, use status text
      }
    }

    throw new Error(errorMessage);
  }

  const gist = await response.json();
  const files = gist.files;
  const filename =
    Object.keys(files).find((name) => name.includes("the-one-tab")) || Object.keys(files)[0];

  if (!filename || !files[filename]) {
    throw new Error("Gist file not found");
  }

  const content = files[filename].content;
  const data: StorageData = JSON.parse(content);

  // Validate data structure
  if (!data.groups || !data.settings) {
    throw new Error("Invalid data format");
  }

  // Save to local storage
  await setStorageDataFromSync(data);

  return data;
}

/**
 * Sync from Gist with auto retry on 401 errors
 * Uses auth service to get token and retry with re-authentication
 */
export async function syncFromGistWithRetry(gistId: string): Promise<StorageData> {
  return withRetryOn401(async (token) => {
    return syncFromGist(token, gistId);
  });
}
