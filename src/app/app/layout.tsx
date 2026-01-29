import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavLinkClient } from "./nav-link-client";

const navItems = [
  { href: "/app", label: "Главная", icon: "🏠" },
  { href: "/app/cuts", label: "Крои", icon: "✂️" },
  { href: "/app/assignments", label: "Выдача швее", icon: "📦" },
  { href: "/app/packaging", label: "Упаковка", icon: "📋" },
  { href: "/app/packaging/journal", label: "Журнал упаковки", icon: "📊" },
  { href: "/app/reports/wip", label: "В работе", icon: "🔄" },
  { href: "/app/payroll", label: "ЗП швей", icon: "💰" },
];

const financeItems = [
  { href: "/app/finance/to-invoice", label: "Выставить счёт", icon: "📝" },
  { href: "/app/finance/invoices", label: "Счета", icon: "📄" },
];

const refItems = [
  { href: "/app/products", label: "Модели", icon: "👗" },
  { href: "/app/inventory", label: "Склад", icon: "📦" },
  { href: "/app/employees", label: "Сотрудники", icon: "👥" },
  { href: "/app/settings", label: "Настройки", icon: "⚙️" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect("/login");

    return (
    <div className="min-h-screen bg-bg">
      <PreconnectSupabase />
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="bg-card border-b md:border-b-0 md:border-r border-border md:min-h-screen flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <Link href="/app" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-primary flex items-center justify-center">
                <span className="text-primary-contrast font-bold text-sm">AP</span>
              </div>
              <div>
                <div className="font-semibold text-text">Atelier Portal</div>
                <div className="text-xs text-muted">Управление цехом</div>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLinkClient key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </NavLinkClient>
            ))}

            <div className="pt-4 mt-4 border-t border-border">
              <div className="px-3 pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                Финансы
              </div>
              {financeItems.map((item) => (
                <NavLinkClient key={item.href} href={item.href} icon={item.icon}>
                  {item.label}
                </NavLinkClient>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-border">
              <div className="px-3 pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                Справочники
              </div>
              {refItems.map((item) => (
                <NavLinkClient key={item.href} href={item.href} icon={item.icon}>
                  {item.label}
                </NavLinkClient>
              ))}
            </div>
          </nav>

          {/* User / Logout */}
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted mb-2 truncate">
              {userData.user.email}
            </div>
            <form action="/auth/signout" method="post">
              <button className="w-full text-left text-sm text-muted hover:text-danger transition-colors">
                Выйти из системы
              </button>
            </form>
          </div>
        </aside>

        {/* Content */}
        <main className="p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
    );
  } catch (error: any) {
    console.error("AppLayout error:", error);
    // Возвращаем простую страницу вместо redirect в catch
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Ошибка загрузки</h1>
          <p className="text-sm text-muted mb-4">{error?.message || "Неизвестная ошибка"}</p>
          <a href="/login" className="text-sm text-primary hover:underline">Войти заново</a>
        </div>
      </div>
    );
  }
}
