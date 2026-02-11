<script lang="ts">
  import { buttonVariants, type ButtonProps } from "./button";
  import { cn } from "$lib/utils";

  interface Props extends ButtonProps {
    class?: string;
    href?: string;
  }

  let {
    variant = "default",
    size = "default",
    class: className = "",
    disabled = false,
    href,
    children,
    ...restProps
  }: Props & { children?: any } = $props();
</script>

{#if href}
  <a
    href={href}
    class={cn(buttonVariants({ variant, size }), className)}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={cn(buttonVariants({ variant, size }), className)}
    disabled={disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
