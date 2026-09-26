import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { Spinner } from "./Spinner";

export const buttonClasses = cva(
  "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
        secondary: "border border-border-strong bg-surface-2 text-fg hover:bg-surface-3",
        outline: "border border-border-strong bg-transparent text-fg hover:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
        link: "h-auto px-0 text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 px-2 text-xs",
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-10 px-4 text-sm",
        xl: "h-11 px-5 text-md",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonClasses>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Variants {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonClasses({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function ButtonLink({ className, variant, size, ...props }: LinkProps & Variants) {
  return <Link className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}
