export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });
}

export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      resolve(tabs);
    });
  });
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabIds, () => {
      resolve();
    });
  });
}

export async function openTab(url: string, pinned: boolean = false): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, pinned }, (tab) => {
      resolve(tab);
    });
  });
}

export function chromeTabToTab(chromeTab: chrome.tabs.Tab): import("../types").Tab {
  return {
    id: `tab_${chromeTab.id}_${Date.now()}`,
    title: chromeTab.title || "Untitled",
    url: chromeTab.url || "",
    favIconUrl: chromeTab.favIconUrl,
    createdAt: Date.now(),
  };
}
