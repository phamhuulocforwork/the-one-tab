// Service worker context has no window; some bundled code may reference it.
if (typeof globalThis !== "undefined" && (globalThis as unknown as { window?: unknown }).window === undefined) {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

import { initStorage } from "./lib/services/storage";
import { initializeAuth } from "./lib/services/auth";

// Initialize storage on extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install" || details.reason === "update") {
    await initStorage();
  }
});

// Initialize auth system on startup
initializeAuth().catch((error) => {
  console.error("[Background] Failed to initialize auth:", error);
});

// Optional: react to storage changes. No dynamic import() - disallowed in ServiceWorker.
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") {
    // Reserved for future use (e.g. auto-sync). Use only static imports in this file.
  }
});
