import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────────
   Badge
───────────────────────────────────────────────────────────────────────────── */
type Variant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-border/60 text-text",
  success: "bg-success/15 text-success",
  warning: "bg-accent/15 text-accent",
  danger: "bg-danger/15 text-danger",
  info: "bg-primary/10 text-primary",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

/* ─────────────────────────────────────────────────────────────────────────────
   StatusBadge
───────────────────────────────────────────────────────────────────────────── */
interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: "idle" | "active" | "complete" | "error";
  label?: string;
}

const statusConfig: Record<
  StatusBadgeProps["status"],
  { color: string; label: string }
> = {
  idle: { color: "bg-muted", label: "Ожидание" },
  active: { color: "bg-accent", label: "В работе" },
  complete: { color: "bg-success", label: "Готово" },
  error: { color: "bg-danger", label: "Ошибка" },
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, label, className, ...props }, ref) => {
    const config = statusConfig[status];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-text",
          className
        )}
        {...props}
      >
        <span className={cn("w-2 h-2 rounded-full", config.color)} />
        {label ?? config.label}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
