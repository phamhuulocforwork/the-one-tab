import type { Group, Settings, StorageData, Tab } from "../types";
import { createDefaultGroup, findGroupById, createNewGroup } from "../utils/groups";

const STORAGE_KEY = "tabManagerData";

async function getStorageData(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as StorageData | undefined;
      if (data) {
        resolve(data);
      } else {
        // Initialize with default data
        const defaultData: StorageData = {
          groups: [createDefaultGroup()],
          settings: {
            closeAndSave: false,
          },
        };
        resolve(defaultData);
      }
    });
  });
}

async function saveStorageData(data: StorageData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      resolve();
    });
  });
}

export async function initStorage(): Promise<void> {
  const data = await getStorageData();
  const hasDefaultGroup = data.groups.some((g) => g.id === "default");
  
  if (!hasDefaultGroup) {
    data.groups.unshift(createDefaultGroup());
    await saveStorageData(data);
  }
}

export async function getGroups(): Promise<Group[]> {
  const data = await getStorageData();
  return data.groups;
}

export async function saveGroup(group: Group): Promise<void> {
  const data = await getStorageData();
  const index = data.groups.findIndex((g) => g.id === group.id);
  
  if (index >= 0) {
    data.groups[index] = { ...group, updatedAt: Date.now() };
  } else {
    data.groups.push({ ...group, updatedAt: Date.now() });
  }
  
  await saveStorageData(data);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const data = await getStorageData();
  // Don't allow deleting default group
  if (groupId === "default") {
    throw new Error("Cannot delete default group");
  }
  data.groups = data.groups.filter((g) => g.id !== groupId);
  await saveStorageData(data);
}

export async function addTabsToGroup(groupId: string, tabs: Tab[]): Promise<void> {
  const data = await getStorageData();
  const group = findGroupById(data.groups, groupId);
  
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }
  
  // Add tabs, avoiding duplicates by URL
  const existingUrls = new Set(group.tabs.map((t) => t.url));
  const newTabs = tabs.filter((t) => !existingUrls.has(t.url));
  
  group.tabs.push(...newTabs);
  group.updatedAt = Date.now();
  
  await saveStorageData(data);
}

export async function removeTabFromGroup(groupId: string, tabId: string): Promise<void> {
  const data = await getStorageData();
  const group = findGroupById(data.groups, groupId);
  
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }
  
  group.tabs = group.tabs.filter((t) => t.id !== tabId);
  group.updatedAt = Date.now();
  
  await saveStorageData(data);
}

export async function reorderTabsInGroup(groupId: string, newOrder: string[]): Promise<void> {
  const data = await getStorageData();
  const group = findGroupById(data.groups, groupId);
  
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }
  
  // Validate that all tab IDs exist
  const existingIds = new Set(group.tabs.map((t) => t.id));
  const invalidIds = newOrder.filter((id) => !existingIds.has(id));
  
  if (invalidIds.length > 0) {
    throw new Error(`Invalid tab IDs: ${invalidIds.join(", ")}`);
  }
  
  // Ensure all tabs are included
  if (newOrder.length !== group.tabs.length) {
    throw new Error("New order must include all tabs");
  }
  
  // Reorder tabs based on newOrder
  const tabMap = new Map(group.tabs.map((t) => [t.id, t]));
  const reorderedTabs = newOrder.map((id) => tabMap.get(id)!);
  
  group.tabs = reorderedTabs;
  group.updatedAt = Date.now();
  await saveStorageData(data);
}

export async function getSettings(): Promise<Settings> {
  const data = await getStorageData();
  return data.settings;
}

// Helper to get active GitHub token (OAuth only)
export async function getGitHubToken(): Promise<string | undefined> {
  const settings = await getSettings();
  return settings.oauthToken;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const data = await getStorageData();
  data.settings = { ...data.settings, ...settings };
  await saveStorageData(data);
}

export async function getStorageDataForSync(): Promise<StorageData> {
  return getStorageData();
}

export async function setStorageDataFromSync(data: StorageData): Promise<void> {
  await saveStorageData(data);
}

export async function reorderGroups(newOrder: string[]): Promise<void> {
  const data = await getStorageData();
  
  // Validate that all group IDs exist
  const existingIds = new Set(data.groups.map((g) => g.id));
  const invalidIds = newOrder.filter((id) => !existingIds.has(id));
  
  if (invalidIds.length > 0) {
    throw new Error(`Invalid group IDs: ${invalidIds.join(", ")}`);
  }
  
  // Ensure all groups are included
  if (newOrder.length !== data.groups.length) {
    throw new Error("New order must include all groups");
  }
  
  // Reorder groups based on newOrder
  const groupMap = new Map(data.groups.map((g) => [g.id, g]));
  const reorderedGroups = newOrder.map((id) => groupMap.get(id)!);
  
  data.groups = reorderedGroups;
  await saveStorageData(data);
}

export async function moveTabBetweenGroups(
  tabId: string,
  fromGroupId: string,
  toGroupId: string
): Promise<void> {
  if (fromGroupId === toGroupId) {
    // Same group, no need to move
    return;
  }
  
  const data = await getStorageData();
  const fromGroup = findGroupById(data.groups, fromGroupId);
  const toGroup = findGroupById(data.groups, toGroupId);
  
  if (!fromGroup) {
    throw new Error(`Source group ${fromGroupId} not found`);
  }
  
  if (!toGroup) {
    throw new Error(`Target group ${toGroupId} not found`);
  }
  
  // Find tab in source group
  const tabIndex = fromGroup.tabs.findIndex((t) => t.id === tabId);
  if (tabIndex === -1) {
    throw new Error(`Tab ${tabId} not found in source group`);
  }
  
  // Remove tab from source group
  const tab = fromGroup.tabs[tabIndex];
  fromGroup.tabs.splice(tabIndex, 1);
  fromGroup.updatedAt = Date.now();
  
  // Check if tab already exists in target group (by URL)
  const existingTabIndex = toGroup.tabs.findIndex((t) => t.url === tab.url);
  if (existingTabIndex !== -1) {
    // Tab with same URL exists, remove it first
    toGroup.tabs.splice(existingTabIndex, 1);
  }
  
  // Add tab to target group
  toGroup.tabs.push(tab);
  toGroup.updatedAt = Date.now();
  
  await saveStorageData(data);
}

export async function createGroup(name: string, description?: string): Promise<Group> {
  if (!name || name.trim() === "") {
    throw new Error("Group name cannot be empty");
  }
  
  const data = await getStorageData();
  
  // Check for duplicate names
  const existingGroup = data.groups.find((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existingGroup) {
    throw new Error(`Group with name "${name}" already exists`);
  }
  
  const newGroup = createNewGroup(name.trim(), description?.trim());
  data.groups.push(newGroup);
  await saveStorageData(data);
  
  return newGroup;
}
