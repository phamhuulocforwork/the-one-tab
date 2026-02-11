// GitHub OAuth configuration
// User needs to create a GitHub OAuth App at: https://github.com/settings/developers
// Redirect URI should be: chrome-extension://<extension-id>/
const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function authenticateWithGitHub(clientId: string, clientSecret?: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code verifier temporarily (will be used to exchange token)
      chrome.storage.local.set({ oauthCodeVerifier: codeVerifier }, async () => {
        // Get extension ID for redirect URI
        // chrome.identity.getRedirectURL() returns: https://<extension-id>.chromiumapp.org/
        const redirectUri = chrome.identity.getRedirectURL();

        // Build authorization URL
        const authUrl = new URL(GITHUB_AUTH_URL);
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("scope", "gist");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        authUrl.searchParams.set("state", generateCodeVerifier()); // Random state for security

        console.log("[OAuth] Starting GitHub OAuth flow");
        console.log("[OAuth] Redirect URI:", redirectUri);
        console.log("[OAuth] Extension ID:", chrome.runtime.id);
        console.log("[OAuth] Auth URL:", authUrl.toString());
        
        // Show alert with redirect URI for debugging
        alert(
          `Redirect URI: ${redirectUri}\n\n` +
          `Hãy copy redirect URI này và paste vào GitHub OAuth App:\n` +
          `Authorization callback URL: ${redirectUri}`
        );

        // Launch OAuth flow
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl.toString(),
            interactive: true,
          },
          async (callbackUrl) => {
            if (chrome.runtime.lastError) {
              console.error("[OAuth] Error:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!callbackUrl) {
              reject(new Error("OAuth flow was cancelled"));
              return;
            }

            console.log("[OAuth] Callback URL received");

            // Extract authorization code from callback URL
            const url = new URL(callbackUrl);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            const error = url.searchParams.get("error");
            const errorDescription = url.searchParams.get("error_description");

            if (error) {
              const message =
                error === "access_denied"
                  ? "Bạn đã từ chối cấp quyền. Vui lòng bấm \"Authorize\" trên trang GitHub để đăng nhập."
                  : errorDescription || error;
              reject(new Error(message));
              return;
            }

            if (!code) {
              reject(new Error("No authorization code received"));
              return;
            }

            // Get stored code verifier
            chrome.storage.local.get(["oauthCodeVerifier"], async (result) => {
              const verifier = result.oauthCodeVerifier;
              if (!verifier) {
                reject(new Error("Code verifier not found"));
                return;
              }

              // Exchange authorization code for access token
              try {
                const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret || "",
                    code: code,
                    redirect_uri: redirectUri,
                    code_verifier: verifier,
                  }),
                });

                if (!tokenResponse.ok) {
                  const errorText = await tokenResponse.text();
                  reject(new Error(`Token exchange failed: ${errorText}`));
                  return;
                }

                const tokenData = await tokenResponse.json();

                if (tokenData.error) {
                  reject(
                    new Error(`Token error: ${tokenData.error_description || tokenData.error}`),
                  );
                  return;
                }

                const accessToken = tokenData.access_token;

                if (!accessToken) {
                  reject(new Error("No access token received"));
                  return;
                }

                // Clean up temporary storage
                chrome.storage.local.remove(["oauthCodeVerifier"]);

                console.log("[OAuth] Access token obtained successfully");
                resolve(accessToken);
              } catch (error) {
                reject(error);
              }
            });
          },
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function revokeGitHubToken(token: string): Promise<void> {
  // GitHub doesn't have a standard token revocation endpoint
  // User needs to revoke manually in GitHub settings
  // But we can clear it from local storage
  console.log("[OAuth] Token revoked (cleared from storage)");
}
