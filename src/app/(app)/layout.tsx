import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SidebarShell } from "@/components/sidebar-nav";

async function SidebarWithUser() {
  const user = await getCurrentUser();
  return <Sidebar userEmail={user?.email ?? null} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={<SidebarShell pathname={null} />}>
        <SidebarWithUser />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
