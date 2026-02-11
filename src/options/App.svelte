<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Switch } from "$lib/components/ui/switch";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";
  import { Settings, CheckCircle2, XCircle, Loader2 } from "@lucide/svelte";
  import type { Settings as SettingsType, AuthState } from "$lib/types";
  import { getSettings, saveSettings } from "$lib/services/storage";
  import {
    createGistWithRetry,
    syncToGistWithRetry,
    syncFromGistWithRetry,
  } from "$lib/services/github";
  import {
    signIn,
    signOut,
    getAuthState,
    onAuthStateChange,
    restoreAuthState,
  } from "$lib/services/auth";

  let settings = $state<SettingsType>({
    closeAndSave: false,
    oauthToken: undefined,
    gistId: undefined,
    githubClientId: undefined,
    githubClientSecret: undefined,
  });
  let githubClientIdInput = $state("");
  let githubClientSecretInput = $state("");
  let gistIdInput = $state("");
  let tokenTestResult = $state<"success" | "error" | null>(null);
  let tokenTestMessage = $state("");
  let syncing = $state(false);
  let authenticating = $state(false);
  let authState = $state<AuthState>({
    isSignedIn: false,
    login: "",
    userInfo: null,
    token: undefined,
  });

  $effect(() => {
    let unsubscribe: (() => void) | null = null;
    
    // Restore auth state first, then load settings and subscribe to changes
    (async () => {
      await restoreAuthState();
      loadSettings();
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

  async function loadSettings() {
    settings = await getSettings();
    githubClientIdInput = settings.githubClientId || "";
    githubClientSecretInput = settings.githubClientSecret || "";
    gistIdInput = settings.gistId || "";
    // Get current auth state
    authState = getAuthState();
  }

  async function handleCloseAndSaveChange(checked: boolean) {
    settings.closeAndSave = checked;
    await saveSettings(settings);
  }

  async function handleOAuthLogin() {
    authenticating = true;
    tokenTestResult = null;
    tokenTestMessage = "";

    try {
      const success = await signIn();
      if (success) {
        tokenTestResult = "success";
        tokenTestMessage = `Đăng nhập thành công! Chào mừng ${authState.login}`;
      }
    } catch (error) {
      console.error("OAuth error:", error);
      tokenTestResult = "error";
      tokenTestMessage = (error as Error).message || "Lỗi khi đăng nhập với GitHub";
    } finally {
      authenticating = false;
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      tokenTestResult = null;
      tokenTestMessage = "";
      alert("Đã đăng xuất");
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Lỗi khi đăng xuất: " + (error as Error).message);
    }
  }


  async function handleSaveGistId() {
    settings.gistId = gistIdInput.trim() || undefined;
    await saveSettings(settings);
    alert("Đã lưu Gist ID!");
  }

  async function handleCreateGist() {
    console.log("[Options] Creating Gist");

    syncing = true;
    try {
      const gistId = await createGistWithRetry();
      settings.gistId = gistId;
      gistIdInput = gistId;
      await saveSettings(settings);
      alert(`Đã tạo Gist mới thành công! ID: ${gistId}`);
    } catch (error) {
      console.error("Error creating Gist:", error);
      const errorMsg = (error as Error).message;
      alert("Lỗi khi tạo Gist:\n\n" + errorMsg);
    } finally {
      syncing = false;
    }
  }

  async function handleSyncToGist() {
    if (!settings.gistId) {
      alert("Vui lòng tạo hoặc nhập Gist ID trước");
      return;
    }

    syncing = true;
    try {
      await syncToGistWithRetry(settings.gistId);
      alert("Đã đồng bộ lên GitHub thành công!");
    } catch (error) {
      console.error("Error syncing to Gist:", error);
      alert("Lỗi khi đồng bộ: " + (error as Error).message);
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
    } catch (error) {
      console.error("Error syncing from Gist:", error);
      alert("Lỗi khi đồng bộ: " + (error as Error).message);
    } finally {
      syncing = false;
    }
  }
</script>

<div class="min-h-screen bg-background p-6">
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Settings class="size-8 text-primary" />
      <div>
        <h1 class="text-3xl font-bold">Settings</h1>
        <p class="text-sm text-muted-foreground">
          Cấu hình extension và đồng bộ với GitHub Gist
        </p>
      </div>
    </div>

    <Separator />

    <!-- General Settings -->
    <Card.Root>
      <Card.Header>
        <Card.Title>General Settings</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label for="close-and-save">Đóng và lưu</Label>
            <p class="text-sm text-muted-foreground">
              Tự động đóng tab sau khi lưu
            </p>
          </div>
          <Switch
            id="close-and-save"
            checked={settings.closeAndSave}
            onCheckedChange={handleCloseAndSaveChange}
          />
        </div>
      </Card.Content>
    </Card.Root>

    <!-- GitHub Settings -->
    <Card.Root>
      <Card.Header>
        <Card.Title>GitHub Gist Settings</Card.Title>
        <Card.Description>
          Đồng bộ dữ liệu với GitHub Gist để backup và sync giữa các thiết bị
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- OAuth Section -->
        <div class="space-y-2">
          <Label for="github-client-id">GitHub OAuth App Credentials</Label>
          <p class="text-xs text-muted-foreground mb-2">
            Tạo OAuth App tại{" "}
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              class="underline"
            >
              GitHub Settings → Developer settings → OAuth Apps
            </a>
            <br />
            <strong>Homepage URL:</strong> Có thể để <code class="text-xs bg-muted px-1 rounded">https://github.com</code> hoặc URL repo của bạn
            <br />
            <strong>Authorization callback URL:</strong> Sẽ được hiển thị khi bạn click "Đăng nhập" bên dưới
          </p>
          <div class="space-y-2">
            <div class="flex gap-2">
              <Input
                id="github-client-id"
                type="text"
                placeholder="Client ID từ GitHub OAuth App"
                bind:value={githubClientIdInput}
                class="flex-1"
              />
            </div>
            <div class="flex gap-2">
              <Input
                id="github-client-secret"
                type="password"
                placeholder="Client Secret từ GitHub OAuth App"
                bind:value={githubClientSecretInput}
                class="flex-1"
              />
              <Button
                variant="default"
                onclick={async () => {
                  if (!githubClientIdInput.trim()) {
                    alert("Vui lòng nhập Client ID");
                    return;
                  }
                  if (!githubClientSecretInput.trim()) {
                    alert("Vui lòng nhập Client Secret");
                    return;
                  }
                  settings.githubClientId = githubClientIdInput.trim();
                  settings.githubClientSecret = githubClientSecretInput.trim();
                  await saveSettings(settings);
                  alert("Đã lưu OAuth credentials!");
                }}
                disabled={!githubClientIdInput.trim() || !githubClientSecretInput.trim()}
              >
                Save Credentials
              </Button>
            </div>
          </div>
          <Button
            class="w-full"
            variant="default"
            onclick={handleOAuthLogin}
            disabled={authenticating || !settings.githubClientId || !settings.githubClientSecret}
          >
            {#if authenticating}
              <span class="flex items-center">
                <Loader2 class="size-4 mr-2 animate-spin" />
                Authenticating...
              </span>
            {:else}
              Đăng nhập với GitHub
            {/if}
          </Button>
          <p class="text-xs text-muted-foreground">
            <strong>Lưu ý:</strong> Khi click button này, extension sẽ hiển thị redirect URI trong alert.
            Copy redirect URI đó và paste vào GitHub OAuth App → Authorization callback URL.
          </p>
          {#if authState.isSignedIn && authState.userInfo}
            <div class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <img
                src={authState.userInfo.avatar_url}
                alt={authState.userInfo.login}
                class="size-10 rounded-full"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                  <CheckCircle2 class="size-4" />
                  <span>Đã đăng nhập với GitHub</span>
                </div>
                <div class="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  @{authState.userInfo.login}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onclick={handleSignOut}
              >
                Đăng xuất
              </Button>
            </div>
          {/if}
        </div>

        {#if tokenTestResult === "success"}
          <div class="flex items-start gap-2 text-sm text-green-600">
            <CheckCircle2 class="size-4 mt-0.5 shrink-0" />
            <span>{tokenTestMessage}</span>
          </div>
        {:else if tokenTestResult === "error"}
          <div class="flex items-start gap-2 text-sm text-destructive">
            <XCircle class="size-4 mt-0.5 shrink-0" />
            <div class="flex-1">
              <p class="font-medium">Lỗi OAuth:</p>
              <pre class="mt-1 text-xs whitespace-pre-wrap break-words bg-destructive/10 p-2 rounded border border-destructive/20">{tokenTestMessage}</pre>
            </div>
          </div>
        {/if}

        <Separator />

        <!-- Gist ID Input -->
        <div class="space-y-2">
          <Label for="gist-id">Gist ID (Optional)</Label>
          <div class="flex gap-2">
            <Input
              id="gist-id"
              type="text"
              placeholder="Nhập Gist ID nếu đã có"
              bind:value={gistIdInput}
              class="flex-1"
            />
            <Button
              variant="default"
              onclick={handleSaveGistId}
              disabled={syncing}
            >
              Save
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Để trống nếu muốn tạo Gist mới
          </p>
        </div>

        <Separator />

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onclick={handleCreateGist}
            disabled={syncing || !authState.isSignedIn}
          >
            {#if syncing}
              <span class="flex items-center">
                <Loader2 class="size-4 mr-2 animate-spin" />
                Creating...
              </span>
            {:else}
              Tạo Gist mới
            {/if}
          </Button>
          <Button
            variant="outline"
            onclick={handleSyncFromGist}
            disabled={syncing || !authState.isSignedIn || !settings.gistId}
          >
            {#if syncing}
              <span class="flex items-center">
                <Loader2 class="size-4 mr-2 animate-spin" />
                Syncing...
              </span>
            {:else}
              Sync từ Gist
            {/if}
          </Button>
          <Button
            variant="default"
            onclick={handleSyncToGist}
            disabled={syncing || !authState.isSignedIn || !settings.gistId}
          >
            {#if syncing}
              <span class="flex items-center">
                <Loader2 class="size-4 mr-2 animate-spin" />
                Syncing...
              </span>
            {:else}
              Sync lên Gist
            {/if}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
