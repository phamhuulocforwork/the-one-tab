import { tv, type VariantProps } from "tailwind-variants";

export const buttonVariants = tv({
  base: "cursor-pointer inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:ring-[3px] outline-none disabled:pointer-events-none disabled:opacity-50",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      destructive: "bg-destructive text-white hover:bg-destructive/90",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-9 px-4 py-2 has-[>svg]:px-3",
      sm: "h-8 gap-1.5 rounded-md px-3 text-sm has-[>svg]:px-2.5",
      lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
      icon: "size-9",
      "icon-sm": "size-8",
      "icon-lg": "size-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  class?: string;
  disabled?: boolean;
  href?: string;
}
