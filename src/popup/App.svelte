<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Switch } from "$lib/components/ui/switch";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { DropdownMenu } from "$lib/components/ui/dropdown-menu";
  import { ChevronDown, FolderOpen, Settings as SettingsIcon, AlertCircle, X } from "@lucide/svelte";
  import * as Alert from "$lib/components/ui/alert";
  import type { Group, Settings, AuthState } from "$lib/types";
  import { getGroups, getSettings, saveSettings, addTabsToGroup } from "$lib/services/storage";
  import { getCurrentTab, getAllTabs, closeTabs, chromeTabToTab } from "$lib/utils/tabs";
  import { syncToGistWithRetry } from "$lib/services/github";
  import { ensureAuthenticated, getAuthState, onAuthStateChange, restoreAuthState } from "$lib/services/auth";

  let groups = $state<Group[]>([]);
  let settings = $state<Settings>({ closeAndSave: false });
  let tabCount = $state(0);
  let loading = $state(false);
  let selectedGroupForCurrent = $state<string>("default");
  let selectedGroupForAll = $state<string>("default");
  let errorMessage = $state<string | null>(null);
  let authState = $state<AuthState>({
    isSignedIn: false,
    login: "",
    userInfo: null,
    token: undefined,
  });

  // Load data on mount
  $effect(() => {
    chrome.tabs.query({}, (tabs) => {
      tabCount = tabs.length;
    });
    
    let unsubscribe: (() => void) | null = null;
    
    // Restore auth state first, then load data and subscribe to changes
    (async () => {
      await restoreAuthState();
      loadData();
      // Subscribe to auth state changes after restore
      unsubscribe = onAuthStateChange((state) => {
        authState = state;
      });
    })();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });

  async function loadData() {
    groups = await getGroups();
    settings = await getSettings();
    // Get current auth state
    authState = getAuthState();
    // Set default group if exists
    const defaultGroup = groups.find((g) => g.id === "default");
    if (defaultGroup) {
      selectedGroupForCurrent = "default";
      selectedGroupForAll = "default";
    }
  }

  async function handleCloseAndSaveChange(checked: boolean) {
    settings.closeAndSave = checked;
    await saveSettings(settings);
    // Clear error when setting changes
    errorMessage = null;
  }

  function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  async function handleSaveCurrentTab() {
    errorMessage = null;
    
    // Check if token is required (when closeAndSave is enabled)
    if (settings.closeAndSave) {
      try {
        await ensureAuthenticated();
      } catch (error) {
        errorMessage = (error as Error).message;
        // Open settings page after a short delay
        setTimeout(() => {
          handleOpenSettings();
        }, 1500);
        return;
      }
    }

    loading = true;
    try {
      const chromeTab = await getCurrentTab();
      if (!chromeTab || !chromeTab.id) {
        return;
      }

      const tab = chromeTabToTab(chromeTab);
      await addTabsToGroup(selectedGroupForCurrent, [tab]);

      // Close tab if setting is enabled
      if (settings.closeAndSave && chromeTab.id) {
        await closeTabs([chromeTab.id]);
      }

      // Sync to GitHub if authenticated
      if (authState.isSignedIn && settings.gistId) {
        try {
          await syncToGistWithRetry(settings.gistId);
        } catch (error) {
          console.error("Failed to sync to GitHub:", error);
          const errorMsg = (error as Error).message;
          errorMessage = "Lỗi khi đồng bộ với GitHub: " + errorMsg;
        }
      }

      // Reload data
      await loadData();
      chrome.tabs.query({}, (tabs) => {
        tabCount = tabs.length;
      });
    } catch (error) {
      console.error("Error saving current tab:", error);
      errorMessage = "Lỗi khi lưu tab: " + (error as Error).message;
    } finally {
      loading = false;
    }
  }

  async function handleSaveAllTabs() {
    errorMessage = null;
    
    // Check if token is required (when closeAndSave is enabled)
    if (settings.closeAndSave) {
      try {
        await ensureAuthenticated();
      } catch (error) {
        errorMessage = (error as Error).message;
        // Open settings page after a short delay
        setTimeout(() => {
          handleOpenSettings();
        }, 1500);
        return;
      }
    }

    loading = true;
    try {
      const chromeTabs = await getAllTabs();
      const tabs = chromeTabs.map(chromeTabToTab);
      const tabIds = chromeTabs.map((t) => t.id!).filter((id): id is number => id !== undefined);

      await addTabsToGroup(selectedGroupForAll, tabs);

      // Close tabs if setting is enabled
      if (settings.closeAndSave && tabIds.length > 0) {
        await closeTabs(tabIds);
      }

      // Sync to GitHub if authenticated
      if (authState.isSignedIn && settings.gistId) {
        try {
          await syncToGistWithRetry(settings.gistId);
        } catch (error) {
          console.error("Failed to sync to GitHub:", error);
          const errorMsg = (error as Error).message;
          errorMessage = "Lỗi khi đồng bộ với GitHub: " + errorMsg;
        }
      }

      // Reload data
      await loadData();
      chrome.tabs.query({}, (tabs) => {
        tabCount = tabs.length;
      });
    } catch (error) {
      console.error("Error saving all tabs:", error);
      errorMessage = "Lỗi khi lưu tabs: " + (error as Error).message;
    } finally {
      loading = false;
    }
  }

  function handleOpenStorage() {
    // CRXJS builds HTML files in src/ directory structure
    const storageUrl = chrome.runtime.getURL("src/storage/index.html");
    chrome.tabs.create({
      url: storageUrl,
      pinned: true,
    }).catch((error) => {
      console.error("Error opening storage page:", error);
      errorMessage = "Không thể mở trang storage. Vui lòng reload extension.";
    });
  }

  // Reactive dropdown items that update when groups change
  let groupDropdownItems = $derived(
    groups.map((g) => ({
      id: g.id,
      label: g.name,
    }))
  );
</script>

<div class="w-[380px] min-h-[400px] p-4 bg-background">
  <div class="space-y-4">
    <!-- Error Alert -->
    {#if errorMessage}
      <Alert.Root variant="destructive">
        <div class="flex items-start gap-3">
          <AlertCircle class="size-4 mt-0.5 shrink-0" />
          <div class="flex-1">
            <Alert.Title>Lỗi</Alert.Title>
            <Alert.Description>{errorMessage}</Alert.Description>
            <div class="mt-2">
              <Button
                size="sm"
                variant="outline"
                onclick={handleOpenSettings}
              >
                <SettingsIcon class="size-3 mr-1" />
                Mở Settings
              </Button>
            </div>
          </div>
          <button
            type="button"
            onclick={() => (errorMessage = null)}
            class="rounded-sm opacity-70 hover:opacity-100"
          >
            <X class="size-4" />
          </button>
        </div>
      </Alert.Root>
    {/if}

    <!-- Actions Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Actions</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="space-y-3">
          <!-- Save Current Tab -->
          <div class="flex items-center gap-2">
            <Button
              class="flex-1"
              variant="default"
              onclick={handleSaveCurrentTab}
              disabled={loading}
            >
              Lưu tab hiện tại
            </Button>
            <DropdownMenu
              items={groupDropdownItems}
              selectedId={selectedGroupForCurrent}
              onSelect={(id) => {
                selectedGroupForCurrent = id;
              }}
            >
              <Button size="icon" variant="outline" title={groups.find((g) => g.id === selectedGroupForCurrent)?.name || "Chọn group"}>
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenu>
          </div>

          <!-- Save All Tabs -->
          <div class="flex items-center gap-2">
            <Button
              class="flex-1"
              variant="outline"
              onclick={handleSaveAllTabs}
              disabled={loading}
            >
              Lưu tất cả
            </Button>
            <DropdownMenu
              items={groupDropdownItems}
              selectedId={selectedGroupForAll}
              onSelect={(id) => {
                selectedGroupForAll = id;
              }}
            >
              <Button size="icon" variant="outline" title={groups.find((g) => g.id === selectedGroupForAll)?.name || "Chọn group"}>
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenu>
          </div>

          <Separator />

          <!-- Open Storage -->
          <Button class="w-full" variant="secondary" onclick={handleOpenStorage}>
            <FolderOpen class="size-4 mr-2" />
            Mở kho lưu
          </Button>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Settings Card -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <Card.Title>Settings</Card.Title>
          <Button
            size="sm"
            variant="ghost"
            onclick={handleOpenSettings}
            class="h-8"
          >
            <SettingsIcon class="size-4 mr-1" />
            Cấu hình
          </Button>
        </div>
        {#if settings.closeAndSave && !authState.isSignedIn}
          <Card.Description class="text-destructive">
            ⚠️ Cần đăng nhập với GitHub (OAuth) để sử dụng tính năng "Đóng và lưu"
          </Card.Description>
        {:else}
          <Card.Description>Cài đặt chung của extension</Card.Description>
        {/if}
      </Card.Header>
      <Card.Content>
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label for="close-and-save">Đóng và lưu</Label>
            {#if settings.closeAndSave && !authState.isSignedIn}
              <p class="text-xs text-destructive">
                Cần đăng nhập với GitHub (OAuth) để đồng bộ dữ liệu
              </p>
            {/if}
          </div>
          <Switch
            id="close-and-save"
            checked={settings.closeAndSave}
            onCheckedChange={handleCloseAndSaveChange}
          />
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Footer -->
    <div class="text-center text-xs text-muted-foreground">
      Được viết bởi{" "}
      <a
        class="underline-offset-2 underline"
        href="https://github.com/phamhuulocforwork"
      >
        Phạm Hữu Lộc
      </a>
    </div>
  </div>
</div>
