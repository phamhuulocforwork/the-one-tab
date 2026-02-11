import type { Group } from "../types";

export function createDefaultGroup(): Group {
  const now = Date.now();
  return {
    id: "default",
    name: "Default",
    description: undefined,
    tabs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function findGroupById(groups: Group[], id: string): Group | undefined {
  return groups.find((g) => g.id === id);
}

export function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createNewGroup(name: string, description?: string): Group {
  const now = Date.now();
  return {
    id: generateGroupId(),
    name,
    description,
    tabs: [],
    createdAt: now,
    updatedAt: now,
  };
}
