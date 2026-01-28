"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
  className?: string;
};

export function KpiCard({ title, value, hint, href, className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border border-border bg-white px-4 py-3 transition",
        "hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/60",
        "active:scale-[0.99]",
        className
      )}
    >
      <div className="text-[12px] text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-[22px] font-semibold leading-none">{value}</div>
        {hint ? (
          <div className="text-[12px] text-muted-foreground group-hover:text-foreground transition">
            {hint}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
