<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    items: Array<{ id: string; label: string }>;
    selectedId?: string;
    onSelect?: (id: string) => void;
    class?: string;
    children?: any;
  }

  let {
    items = [],
    selectedId: propSelectedId,
    onSelect,
    class: className = "",
    children,
  }: Props = $props();

  let open = $state(false);
  let selectedId = $state<string | null>(propSelectedId || null);

  $effect(() => {
    if (propSelectedId !== undefined) {
      selectedId = propSelectedId;
    }
  });

  function handleSelect(id: string) {
    selectedId = id;
    onSelect?.(id);
    open = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".dropdown-menu")) {
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
</script>

<div class={cn("relative dropdown-menu", className)}>
  <button
    type="button"
    onclick={() => (open = !open)}
    class="inline-flex items-center justify-center"
  >
    {@render children?.()}
  </button>

  {#if open}
    <div
      class="absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style="top: 100%; right: 0;"
    >
      {#each items as item}
        <button
          type="button"
          onclick={() => handleSelect(item.id)}
          class={cn(
            "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
            selectedId === item.id && "bg-accent"
          )}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
