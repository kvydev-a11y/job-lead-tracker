"use client";

import { usePathname } from "next/navigation";
import { SidebarShell } from "./sidebar-nav";

export function Sidebar() {
  const pathname = usePathname();
  return <SidebarShell pathname={pathname} />;
}
