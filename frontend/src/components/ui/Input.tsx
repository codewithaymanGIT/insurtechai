import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const base =
  "w-full rounded-md border border-border-strong bg-surface text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] " +
  "hover:border-fg-subtle/60 focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/70 aria-[invalid=true]:ring-danger/15";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputSize?: "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, prefix, suffix, inputSize = "md", ...props }, ref) => {
  const h = inputSize === "lg" ? "h-10" : "h-8";
  if (!prefix && !suffix) return <input ref={ref} className={cn(base, h, "px-2.5", className)} {...props} />;
  return (
    <div className="relative flex items-center">
      {prefix && <span className="pointer-events-none absolute left-2.5 text-sm text-fg-subtle">{prefix}</span>}
      <input ref={ref} className={cn(base, h, prefix ? "pl-6" : "pl-2.5", suffix ? "pr-10" : "pr-2.5", className)} {...props} />
      {suffix && <span className="pointer-events-none absolute right-2.5 text-xs text-fg-subtle">{suffix}</span>}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-[72px] resize-none px-3 py-2 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
  aside?: ReactNode;
}

/** Label + control + hint/error, with the ids wired for screen readers. */
export function Field({ label, hint, error, children, className, aside }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-fg-muted">
          {label}
        </label>
        {aside}
      </div>
      {children(id)}
      {error ? (
        <p className="text-2xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
