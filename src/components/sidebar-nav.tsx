import Link from "next/link";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Inbox,
  BarChart3,
  Briefcase,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: KanbanSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string | null, href: string) {
  if (pathname == null) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Pure presentational nav. Rendered server-side as the Suspense fallback (with
 * pathname=null, no active highlight) and client-side by <Sidebar> with the
 * live pathname — so active state streams in without blocking the prerender.
 */
export function SidebarShell({ pathname }: { pathname: string | null }) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Briefcase className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Job&nbsp;Tracker</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(pathname, href)
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <p className="px-5 py-4 text-[11px] leading-relaxed text-slate-400">
          Personal job-search dashboard
        </p>
      </aside>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
              isActive(pathname, href)
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-300",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>
    </>
  );
}
