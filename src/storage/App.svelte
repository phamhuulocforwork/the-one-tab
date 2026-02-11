<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";
  import {
    FolderOpen,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Trash2,
    RefreshCw,
    Settings,
    Plus,
    GripVertical,
    X,
    Pencil,
  } from "@lucide/svelte";
  import type { Group, Tab, AuthState } from "$lib/types";
  import {
    getGroups,
    removeTabFromGroup,
    getSettings,
    reorderGroups,
    moveTabBetweenGroups,
    createGroup,
    reorderTabsInGroup,
  } from "$lib/services/storage";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { syncFromGistWithRetry, syncToGistWithRetry } from "$lib/services/github";
  import { openTab } from "$lib/utils/tabs";
  import { getAuthState, onAuthStateChange, restoreAuthState } from "$lib/services/auth";

  let groups = $state<Group[]>([]);
  let expandedGroups = $state<Set<string>>(new Set());
  let loading = $state(false);
  let syncing = $state(false);
  let settings = $state({ gistId: undefined });
  let authState = $state<AuthState>({
    isSignedIn: false,
    login: "",
    userInfo: null,
    token: undefined,
  });

  // Drag & drop state
  let draggedGroupIndex = $state<number | null>(null);
  let draggedTab = $state<{ id: string; groupId: string; index: number } | null>(null);
  let dragOverGroupId = $state<string | null>(null);
  let dragOverTabIndex = $state<number | null>(null);

  // Create group dialog state
  let showCreateGroupDialog = $state(false);
  let newGroupName = $state("");
  let newGroupDescription = $state("");
  let creatingGroup = $state(false);

  // Edit group dialog state
  let showEditGroupDialog = $state(false);
  let editingGroup = $state<Group | null>(null);
  let editGroupName = $state("");
  let editGroupDescription = $state("");
  let updatingGroup = $state(false);

  $effect(() => {
    let unsubscribe: (() => void) | null = null;
    let storageListener: ((changes: chrome.storage.StorageChange, areaName: string) => void) | null = null;
    
    // Restore auth state first, then load data and subscribe to changes
    (async () => {
      await restoreAuthState();
      loadData();
      // Subscribe to auth state changes after restore
      unsubscribe = onAuthStateChange((state: AuthState) => {
        authState = state;
      });
      // Listen for storage changes
      storageListener = (changes, areaName) => {
        if (areaName === "local") {
          loadData();
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
    })();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (storageListener) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  });

  async function loadData() {
    loading = true;
    try {
      groups = await getGroups();
      settings = await getSettings();
      // Get current auth state
      authState = getAuthState();
      // Auto-expand all groups
      expandedGroups = new Set(groups.map((g) => g.id));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      loading = false;
    }
  }

  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups);
  }

  async function handleOpenTab(tab: Tab) {
    await openTab(tab.url, false);
  }

  async function handleRemoveTab(groupId: string, tabId: string) {
    try {
      await removeTabFromGroup(groupId, tabId);
      await loadData();
    } catch (error) {
      console.error("Error removing tab:", error);
    }
  }

  async function handleSyncToGist() {
    if (!settings.gistId) {
      alert("Vui lòng nhập Gist ID trước");
      return;
    }

    syncing = true;
    try {
      await syncToGistWithRetry(settings.gistId);
      alert("Đã đồng bộ lên GitHub thành công!");
      await loadData();
    } catch (error) {
      console.error("Error syncing to Gist:", error);
      const errorMsg = (error as Error).message;
      alert("Lỗi khi đồng bộ lên GitHub: " + errorMsg);
    } finally {
      syncing = false;
    }
  }

  async function handleSyncFromGist() {
    if (!settings.gistId) {
      alert("Vui lòng nhập Gist ID trước");
      return;
    }

    syncing = true;
    try {
      await syncFromGistWithRetry(settings.gistId);
      alert("Đã đồng bộ từ GitHub thành công!");
      await loadData();
    } catch (error) {
      console.error("Error syncing from Gist:", error);
      const errorMsg = (error as Error).message;
      alert("Lỗi khi đồng bộ từ GitHub: " + errorMsg);
    } finally {
      syncing = false;
    }
  }

  function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  // Group drag & drop handlers
  function handleGroupDragStart(e: DragEvent, index: number) {
    // Don't allow dragging default group
    if (groups[index].id === "default") {
      e.preventDefault();
      return;
    }
    draggedGroupIndex = index;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", groups[index].id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add("opacity-50");
    }
  }

  function handleGroupDragEnd(e: DragEvent) {
    draggedGroupIndex = null;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove("opacity-50");
    }
  }

  function handleGroupDragOver(e: DragEvent, index: number) {
    // Only handle group drag, let tab drag pass through
    if (draggedGroupIndex === null) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    dragOverGroupId = groups[index].id;
  }

  function handleGroupDragLeave() {
    // Only clear if we were dragging a group
    if (draggedGroupIndex !== null) {
      dragOverGroupId = null;
    }
  }

  async function handleGroupDrop(e: DragEvent, targetIndex: number) {
    // Only handle group drop, let tab drop pass through to Card.Content
    if (draggedGroupIndex === null) {
      return; // Don't prevent default, let event bubble to Card.Content
    }

    e.preventDefault();
    dragOverGroupId = null;

    if (draggedGroupIndex === targetIndex) {
      return;
    }

    // Don't allow reordering default group
    if (groups[targetIndex].id === "default" || groups[draggedGroupIndex].id === "default") {
      return;
    }

    try {
      // Create new order
      const newOrder = [...groups.map((g) => g.id)];
      const [removed] = newOrder.splice(draggedGroupIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      await reorderGroups(newOrder);
      await loadData();
    } catch (error) {
      console.error("Error reordering groups:", error);
      alert("Lỗi khi sắp xếp groups: " + (error as Error).message);
    }
  }

  // Tab drag & drop handlers
  function handleTabDragStart(e: DragEvent, tab: Tab, groupId: string, tabIndex: number) {
    draggedTab = { id: tab.id, groupId, index: tabIndex };
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", tab.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add("opacity-50");
    }
  }

  function handleTabDragEnd(e: DragEvent) {
    draggedTab = null;
    dragOverGroupId = null;
    dragOverTabIndex = null;
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove("opacity-50");
    }
  }

  function handleGroupDropZoneDragOver(e: DragEvent, groupId: string) {
    if (!draggedTab) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to Card.Root
    e.dataTransfer!.dropEffect = "move";
    dragOverGroupId = groupId;
  }

  function handleGroupDropZoneDragLeave() {
    dragOverGroupId = null;
  }

  async function handleGroupDropZoneDrop(e: DragEvent, targetGroupId: string) {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to Card.Root
    dragOverGroupId = null;

    if (!draggedTab) {
      return;
    }

    // If dropping in the same group, do nothing (reorder is handled by tab drop)
    if (draggedTab.groupId === targetGroupId) {
      return;
    }

    try {
      await moveTabBetweenGroups(draggedTab.id, draggedTab.groupId, targetGroupId);
      await loadData();
    } catch (error) {
      console.error("Error moving tab:", error);
      alert("Lỗi khi di chuyển tab: " + (error as Error).message);
    }
  }

  // Tab reorder handlers (within same group)
  function handleTabDragOver(e: DragEvent, groupId: string, tabIndex: number) {
    if (!draggedTab || draggedTab.groupId !== groupId) {
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    dragOverTabIndex = tabIndex;
  }

  function handleTabDragLeave() {
    dragOverTabIndex = null;
  }

  async function handleTabDrop(e: DragEvent, targetGroupId: string, targetTabIndex: number) {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to Card.Content and Card.Root
    dragOverTabIndex = null;

    if (!draggedTab || draggedTab.groupId !== targetGroupId) {
      return;
    }

    // Same group, reorder tabs
    if (draggedTab.index === targetTabIndex) {
      return; // Same position, no change
    }

    try {
      const group = groups.find((g) => g.id === targetGroupId);
      if (!group) {
        return;
      }

      // Create new order
      const newOrder = [...group.tabs.map((t) => t.id)];
      const [removed] = newOrder.splice(draggedTab.index, 1);
      newOrder.splice(targetTabIndex, 0, removed);

      await reorderTabsInGroup(targetGroupId, newOrder);
      await loadData();
    } catch (error) {
      console.error("Error reordering tabs:", error);
      alert("Lỗi khi sắp xếp tabs: " + (error as Error).message);
    }
  }

  // Create group handlers
  function handleOpenCreateGroupDialog() {
    showCreateGroupDialog = true;
    newGroupName = "";
    newGroupDescription = "";
  }

  function handleCloseCreateGroupDialog() {
    showCreateGroupDialog = false;
    newGroupName = "";
    newGroupDescription = "";
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      alert("Vui lòng nhập tên group");
      return;
    }

    creatingGroup = true;
    try {
      await createGroup(newGroupName.trim(), newGroupDescription.trim() || undefined);
      await loadData();
      handleCloseCreateGroupDialog();
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Lỗi khi tạo group: " + (error as Error).message);
    } finally {
      creatingGroup = false;
    }
  }

  // Edit group handlers
  function handleOpenEditGroupDialog(group: Group) {
    editingGroup = group;
    editGroupName = group.name;
    editGroupDescription = group.description || "";
    showEditGroupDialog = true;
  }

  function handleCloseEditGroupDialog() {
    showEditGroupDialog = false;
    editingGroup = null;
    editGroupName = "";
    editGroupDescription = "";
  }

  async function handleUpdateGroup() {
    if (!editingGroup || !editGroupName.trim()) {
      alert("Vui lòng nhập tên group");
      return;
    }

    updatingGroup = true;
    try {
      const { saveGroup } = await import("$lib/services/storage");
      await saveGroup({
        ...editingGroup,
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || undefined,
      });
      await loadData();
      handleCloseEditGroupDialog();
    } catch (error) {
      console.error("Error updating group:", error);
      alert("Lỗi khi cập nhật group: " + (error as Error).message);
    } finally {
      updatingGroup = false;
    }
  }
</script>

<div class="min-h-screen bg-background p-6">
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <FolderOpen class="size-8 text-primary" />
        <div>
          <h1 class="text-3xl font-bold">Kho lưu tabs</h1>
          <p class="text-sm text-muted-foreground">
            Quản lý và tổ chức các tab đã lưu
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button variant="default" onclick={handleOpenCreateGroupDialog}>
          <Plus class="size-4 mr-2" />
          Tạo Group mới
        </Button>
        <Button variant="outline" onclick={handleOpenSettings}>
          <Settings class="size-4 mr-2" />
          Settings
        </Button>
        {#if authState.isSignedIn}
          <Button variant="outline" onclick={handleSyncFromGist} disabled={syncing}>
            <RefreshCw class="size-4 mr-2" />
            Sync từ Gist
          </Button>
          <Button variant="default" onclick={handleSyncToGist} disabled={syncing}>
            <RefreshCw class="size-4 mr-2" />
            Sync lên Gist
          </Button>
        {/if}
      </div>
    </div>

    <Separator />

    {#if loading}
      <div class="text-center py-8 text-muted-foreground">Đang tải...</div>
    {:else if groups.length === 0}
      <Card.Root>
        <Card.Content class="py-12 text-center">
          <p class="text-muted-foreground">Chưa có group nào. Hãy lưu một tab từ popup!</p>
        </Card.Content>
      </Card.Root>
    {:else}
      <!-- Groups List -->
      <div class="space-y-4">
        {#each groups as group, index (group.id)}
          <Card.Root
            draggable={group.id !== "default"}
            ondragstart={(e: DragEvent) => handleGroupDragStart(e, index)}
            ondragend={handleGroupDragEnd}
            ondragover={(e: DragEvent) => handleGroupDragOver(e, index)}
            ondragleave={handleGroupDragLeave}
            ondrop={(e: DragEvent) => handleGroupDrop(e, index)}
            class="transition-all {dragOverGroupId === group.id && draggedGroupIndex !== null ? 'ring-2 ring-primary' : ''} {draggedGroupIndex === index ? 'opacity-50' : ''}"
          >
            <Card.Header class="group">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 flex-1">
                  {#if group.id !== "default"}
                    <div class="cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical class="size-4" />
                    </div>
                  {/if}
                  <button
                    type="button"
                    onclick={() => toggleGroup(group.id)}
                    class="p-1 hover:bg-accent rounded"
                  >
                    {#if expandedGroups.has(group.id)}
                      <ChevronDown class="size-4" />
                    {:else}
                      <ChevronRight class="size-4" />
                    {/if}
                  </button>
                  <div class="flex-1">
                    <Card.Title class="text-lg">{group.name}</Card.Title>
                    {#if group.description}
                      <Card.Description>{group.description}</Card.Description>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-sm text-muted-foreground">
                    {group.tabs.length} {group.tabs.length === 1 ? "tab" : "tabs"}
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onclick={(e: MouseEvent) => {
                      e.stopPropagation();
                      handleOpenEditGroupDialog(group);
                    }}
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil class="size-4" />
                  </Button>
                </div>
              </div>
            </Card.Header>

            {#if expandedGroups.has(group.id)}
              <Card.Content
                ondragover={(e: DragEvent) => handleGroupDropZoneDragOver(e, group.id)}
                ondragleave={handleGroupDropZoneDragLeave}
                ondrop={(e: DragEvent) => handleGroupDropZoneDrop(e, group.id)}
                class="min-h-[50px] {dragOverGroupId === group.id && draggedTab ? 'bg-primary/10 border-2 border-primary border-dashed rounded-md' : ''}"
              >
                {#if group.tabs.length === 0}
                  <div class="text-sm text-muted-foreground py-4 text-center">
                    {#if dragOverGroupId === group.id && draggedTab}
                      Thả tab vào đây
                    {:else}
                      Chưa có tab nào trong group này
                    {/if}
                  </div>
                {:else}
                  <div class="space-y-2">
                    {#each group.tabs as tab, tabIndex (tab.id)}
                      <div
                        draggable="true"
                        ondragstart={(e: DragEvent) => handleTabDragStart(e, tab, group.id, tabIndex)}
                        ondragend={handleTabDragEnd}
                        ondragover={(e: DragEvent) => handleTabDragOver(e, group.id, tabIndex)}
                        ondragleave={handleTabDragLeave}
                        ondrop={(e: DragEvent) => handleTabDrop(e, group.id, tabIndex)}
                        role="button"
                        tabindex="0"
                        class="flex items-center gap-3 p-3 rounded-md border hover:bg-accent/50 transition-colors cursor-pointer group {draggedTab?.id === tab.id ? 'opacity-50' : ''} {dragOverTabIndex === tabIndex && draggedTab?.groupId === group.id ? 'border-primary border-2 bg-primary/10' : ''}"
                        onclick={() => handleOpenTab(tab)}
                        onkeydown={(e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOpenTab(tab);
                          }
                        }}
                      >
                        <div class="cursor-move text-muted-foreground hover:text-foreground">
                          <GripVertical class="size-4" />
                        </div>
                        {#if tab.favIconUrl}
                          <img
                            src={tab.favIconUrl}
                            alt=""
                            class="size-4 shrink-0"
                            onerror={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        {:else}
                          <div class="size-4 shrink-0 bg-muted rounded"></div>
                        {/if}
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate">{tab.title}</p>
                          <p class="text-xs text-muted-foreground truncate">{tab.url}</p>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onclick={(e: MouseEvent) => {
                              e.stopPropagation();
                              handleRemoveTab(group.id, tab.id);
                            }}
                          >
                            <Trash2 class="size-3" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onclick={(e: MouseEvent) => {
                              e.stopPropagation();
                              handleOpenTab(tab);
                            }}
                          >
                            <ExternalLink class="size-3" />
                          </Button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </Card.Content>
            {/if}
          </Card.Root>
        {/each}
      </div>
    {/if}

    <!-- Create Group Dialog -->
    {#if showCreateGroupDialog}
      <div 
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
        onclick={(e: MouseEvent) => {
          // Only close if clicking directly on backdrop, not on card
          if (e.target === e.currentTarget) {
            handleCloseCreateGroupDialog();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <Card.Root class="w-full max-w-md m-4" onclick={(e: MouseEvent) => e.stopPropagation()}>
          <Card.Header>
            <div class="flex items-center justify-between">
              <Card.Title id="create-group-title">Tạo Group mới</Card.Title>
              <button
                type="button"
                onclick={handleCloseCreateGroupDialog}
                class="p-1 hover:bg-accent rounded"
              >
                <X class="size-4" />
              </button>
            </div>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label for="group-name">Tên Group *</Label>
              <Input
                id="group-name"
                type="text"
                placeholder="Nhập tên group"
                bind:value={newGroupName}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    handleCreateGroup();
                  }
                }}
                autofocus
              />
            </div>
            <div class="space-y-2">
              <Label for="group-description">Mô tả (tùy chọn)</Label>
              <Input
                id="group-description"
                type="text"
                placeholder="Nhập mô tả cho group"
                bind:value={newGroupDescription}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    handleCreateGroup();
                  }
                }}
              />
            </div>
            <div class="flex gap-2 justify-end">
              <Button variant="outline" onclick={handleCloseCreateGroupDialog} disabled={creatingGroup}>
                Hủy
              </Button>
              <Button onclick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()}>
                {#if creatingGroup}
                  Đang tạo...
                {:else}
                  Tạo
                {/if}
              </Button>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    {/if}

    <!-- Edit Group Dialog -->
    {#if showEditGroupDialog && editingGroup}
      <div 
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
        onclick={(e: MouseEvent) => {
          // Only close if clicking directly on backdrop, not on card
          if (e.target === e.currentTarget) {
            handleCloseEditGroupDialog();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-group-title"
      >
        <Card.Root class="w-full max-w-md m-4" onclick={(e: MouseEvent) => e.stopPropagation()}>
          <Card.Header>
            <div class="flex items-center justify-between">
              <Card.Title id="edit-group-title">Chỉnh sửa Group</Card.Title>
              <button
                type="button"
                onclick={handleCloseEditGroupDialog}
                class="p-1 hover:bg-accent rounded"
              >
                <X class="size-4" />
              </button>
            </div>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label for="edit-group-name">Tên Group *</Label>
              <Input
                id="edit-group-name"
                type="text"
                placeholder="Nhập tên group"
                bind:value={editGroupName}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    handleUpdateGroup();
                  }
                }}
                autofocus
              />
            </div>
            <div class="space-y-2">
              <Label for="edit-group-description">Mô tả (tùy chọn)</Label>
              <Input
                id="edit-group-description"
                type="text"
                placeholder="Nhập mô tả cho group"
                bind:value={editGroupDescription}
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    handleUpdateGroup();
                  }
                }}
              />
            </div>
            <div class="flex gap-2 justify-end">
              <Button variant="outline" onclick={handleCloseEditGroupDialog} disabled={updatingGroup}>
                Hủy
              </Button>
              <Button onclick={handleUpdateGroup} disabled={updatingGroup || !editGroupName.trim()}>
                {#if updatingGroup}
                  Đang cập nhật...
                {:else}
                  Cập nhật
                {/if}
              </Button>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    {/if}
  </div>
</div>
