import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; hint?: string }[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}

export function Select<T extends string>({ id, value, onChange, options, className, size = "md", ...rest }: SelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={rest["aria-label"]}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-2.5 text-left text-sm text-fg transition-[border-color,box-shadow]",
          "hover:border-fg-subtle/60 focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20 data-[state=open]:border-accent/70",
          size === "sm" ? "h-7 text-xs" : "h-8",
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronsUpDown className="size-3.5 text-fg-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg bg-surface shadow-pop animate-pop-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 pr-7 text-sm text-fg outline-none data-[highlighted]:bg-surface-2"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.hint && <span className="text-xs text-fg-subtle">{o.hint}</span>}
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="size-3.5 text-accent-text" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
