<script lang="ts">
  import { cn } from "$lib/utils";
  import { Check, ChevronDown } from "@lucide/svelte";

  interface Props {
    items: Array<{ id: string; label: string }>;
    selectedIds?: string[];
    onChange?: (ids: string[]) => void;
    class?: string;
  }

  let {
    items = [],
    selectedIds: propSelectedIds = [],
    onChange,
    class: className = "",
  }: Props = $props();

  let open = $state(false);
  let selectedIds = $state<string[]>([]);

  $effect(() => {
    selectedIds = Array.isArray(propSelectedIds) ? [...propSelectedIds] : [];
  });

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    selectedIds = next;
    onChange?.(next);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".dropdown-menu-multi")) {
      open = false;
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  });

  function buttonLabel(): string {
    if (selectedIds.length === 0) return "Chọn group";
    if (selectedIds.length === 1) {
      const item = items.find((i) => i.id === selectedIds[0]);
      return item?.label ?? "1 group";
    }
    return `${selectedIds.length} groups`;
  }
</script>

<div class={cn("relative dropdown-menu-multi", className)}>
  <button
    type="button"
    onclick={() => (open = !open)}
    class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-2 text-sm min-w-[7rem] justify-between hover:bg-accent"
    title={buttonLabel()}
  >
    <span class="truncate">{buttonLabel()}</span>
    <ChevronDown class="size-4 shrink-0 opacity-50" />
  </button>

  {#if open}
    <div
      class="absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style="top: 100%; right: 0;"
    >
      {#each items as item}
        <button
          type="button"
          onclick={() => toggle(item.id)}
          class={cn(
            "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
            selectedIds.includes(item.id) && "bg-accent"
          )}
        >
          {#if selectedIds.includes(item.id)}
            <Check class="size-4 shrink-0" />
          {:else}
            <span class="size-4 shrink-0" aria-hidden="true"></span>
          {/if}
          <span class="truncate">{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
