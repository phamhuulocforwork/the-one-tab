<script lang="ts">
  import { switchVariants } from "./switch";
  import { cn } from "$lib/utils";

  interface Props {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    class?: string;
  }

  let {
    checked = $bindable(false),
    onCheckedChange,
    disabled = false,
    class: className = "",
  }: Props = $props();

  const { root, thumb } = switchVariants();

  function handleClick() {
    if (!disabled) {
      const newChecked = !checked;
      checked = newChecked;
      onCheckedChange?.(newChecked);
    }
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  data-state={checked ? "checked" : "unchecked"}
  disabled={disabled}
  class={cn(root(), className)}
  onclick={handleClick}
>
  <span data-state={checked ? "checked" : "unchecked"} class={thumb()} />
</button>
