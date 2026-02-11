<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    variant?: "default" | "destructive";
    class?: string;
    children?: any;
  }

  let {
    variant = "default",
    class: className = "",
    children,
  }: Props = $props();
</script>

<div
  role="alert"
  class={cn(
    "relative w-full rounded-lg border p-4",
    variant === "destructive" &&
      "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    className
  )}
>
  {@render children?.()}
</div>
