import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────────
   Card
───────────────────────────────────────────────────────────────────────────── */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl bg-card border border-border",
          variant === "elevated" && "shadow-card",
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

/* ─────────────────────────────────────────────────────────────────────────────
   CardHeader
───────────────────────────────────────────────────────────────────────────── */
export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-4 py-3 border-b border-border", className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CardTitle
───────────────────────────────────────────────────────────────────────────── */
export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-text", className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CardDescription
───────────────────────────────────────────────────────────────────────────── */
export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted mt-1", className)} {...props} />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CardBody / CardContent
───────────────────────────────────────────────────────────────────────────── */
export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export const CardContent = CardBody;

/* ─────────────────────────────────────────────────────────────────────────────
   CardFooter
───────────────────────────────────────────────────────────────────────────── */
export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-border flex items-center gap-3",
        className
      )}
      {...props}
    />
  );
}
