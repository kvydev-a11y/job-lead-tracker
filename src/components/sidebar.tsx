"use client";

import { usePathname } from "next/navigation";
import { SidebarShell } from "./sidebar-nav";

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  return <SidebarShell pathname={pathname} userEmail={userEmail} />;
}
