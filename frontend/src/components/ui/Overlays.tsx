import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useT } from "../../context/I18nContext";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/60 backdrop-blur-[2px] animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[18vh] z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 rounded-xl bg-surface p-5 shadow-pop animate-pop-in focus:outline-none",
            className,
          )}
        >
          <DialogPrimitive.Title className="text-md font-medium text-fg">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-1.5 text-sm text-fg-muted">{description}</DialogPrimitive.Description>}
          {children}
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label={t("Close")}>
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Left-edge drawer used for navigation on small screens. */
export function Sheet({ open, onOpenChange, children, label }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; label: string }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/60 animate-fade-in" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[85vw] flex-col border-r border-border bg-bg-subtle animate-slide-in-left focus:outline-none">
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DropdownMenu = Menu.Root;
export const DropdownTrigger = Menu.Trigger;

export function DropdownContent({ children, align = "start", side = "bottom", className }: { children: ReactNode; align?: "start" | "end"; side?: "top" | "bottom"; className?: string }) {
  return (
    <Menu.Portal>
      <Menu.Content align={align} side={side} sideOffset={6} className={cn("z-50 min-w-[200px] rounded-lg bg-surface p-1 shadow-pop animate-pop-in", className)}>
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownItem({ children, onSelect, className, icon, shortcut }: { children: ReactNode; onSelect?: () => void; className?: string; icon?: ReactNode; shortcut?: ReactNode }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn("flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-fg-subtle", className)}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut}
    </Menu.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="px-2 pb-1 pt-1.5 text-2xs text-fg-subtle">{children}</Menu.Label>;
}

export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}
