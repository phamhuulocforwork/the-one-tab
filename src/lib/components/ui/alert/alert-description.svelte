<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
    children?: any;
  }

  let { class: className = "", children }: Props = $props();
</script>

<div class={cn("text-sm [&_p]:leading-relaxed", className)}>
  {@render children?.()}
</div>
