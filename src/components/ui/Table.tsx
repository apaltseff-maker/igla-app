import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────────────────────────────────────
   Table
───────────────────────────────────────────────────────────────────────────── */
export const Table = forwardRef<
  HTMLTableElement,
  HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="overflow-auto rounded-xl border border-border">
    <table
      ref={ref}
      className={cn("w-full text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

/* ─────────────────────────────────────────────────────────────────────────────
   TableHeader
───────────────────────────────────────────────────────────────────────────── */
export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-bg", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

/* ─────────────────────────────────────────────────────────────────────────────
   TableBody
───────────────────────────────────────────────────────────────────────────── */
export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("bg-card", className)} {...props} />
));
TableBody.displayName = "TableBody";

/* ─────────────────────────────────────────────────────────────────────────────
   TableFooter
───────────────────────────────────────────────────────────────────────────── */
export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("bg-bg border-t border-border font-medium", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

/* ─────────────────────────────────────────────────────────────────────────────
   TableRow
───────────────────────────────────────────────────────────────────────────── */
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  clickable?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, clickable, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border last:border-0 transition-colors duration-100",
        clickable
          ? "cursor-pointer hover:bg-accent/5 active:bg-accent/10"
          : "hover:bg-bg/50",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

/* ─────────────────────────────────────────────────────────────────────────────
   TableHead
───────────────────────────────────────────────────────────────────────────── */
export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "p-3 text-left font-semibold text-text first:pl-4 last:pr-4",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

/* ─────────────────────────────────────────────────────────────────────────────
   TableCell
───────────────────────────────────────────────────────────────────────────── */
export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-3 text-text first:pl-4 last:pr-4", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

/* ─────────────────────────────────────────────────────────────────────────────
   TableFilterRow
───────────────────────────────────────────────────────────────────────────── */
export const TableFilterRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("border-b border-border bg-card", className)}
    {...props}
  />
));
TableFilterRow.displayName = "TableFilterRow";

/* ─────────────────────────────────────────────────────────────────────────────
   TableFilterCell
───────────────────────────────────────────────────────────────────────────── */
export const TableFilterCell = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, children, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("p-2 first:pl-4 last:pr-4", className)}
    {...props}
  >
    {children}
  </th>
));
TableFilterCell.displayName = "TableFilterCell";
