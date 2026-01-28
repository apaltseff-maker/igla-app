"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  icon?: string;
  children: React.ReactNode;
}

export function NavLinkClient({ href, icon, children }: NavLinkProps) {
  const pathname = usePathname();
  
  // Check if this link is active
  // For "/app" we need exact match, for others we check if pathname starts with href
  const isActive = href === "/app" 
    ? pathname === "/app"
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)]
        text-sm font-medium transition-all duration-150
        ${
          isActive
            ? "bg-accent/10 text-accent"
            : "text-text hover:bg-bg active:bg-border/50"
        }
      `}
    >
      {icon && <span className="text-base">{icon}</span>}
      {children}
    </Link>
  );
}
