import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-border-strong p-[2px] transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-3",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3 rounded-full bg-fg shadow transition-transform duration-150 data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  );
}

/** A full-width row with a label on the left and a switch on the right. */
export function SwitchRow({ id, label, hint, checked, onChange }: { id?: string; label: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border-strong bg-surface px-3 py-2.5 transition-colors hover:border-fg-subtle/60">
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-2xs text-fg-subtle">{hint}</span>}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...props}>
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3.5 rounded-full border-2 border-accent bg-bg shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25" />
    </SliderPrimitive.Root>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
  "aria-label": string;
}

export function Segmented<T extends string>({ value, onChange, options, className, ...rest }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={rest["aria-label"]} className={cn("inline-flex rounded-md border border-border-strong bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 flex-1 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface-3 text-fg shadow-[0_0_0_1px_hsl(var(--border-strong))]" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Stepper for small counts (accidents, dependents) where typing is fiddly. */
export function Stepper({ id, value, onChange, min = 0, max = 20 }: { id?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const t = useT();
  const btn = "flex h-full w-8 items-center justify-center text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30";
  return (
    <div className="flex h-8 items-stretch overflow-hidden rounded-md border border-border-strong bg-surface">
      <button type="button" aria-label={t("Decrease")} className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <input
        id={id}
        inputMode="numeric"
        className="num w-full min-w-0 border-x border-border-strong bg-transparent text-center text-sm text-fg focus:outline-none"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" aria-label={t("Increase")} className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}
