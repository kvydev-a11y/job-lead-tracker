import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SidebarShell } from "@/components/sidebar-nav";
import { DemoBanner } from "@/components/demo-banner";

async function SidebarWithUser() {
  const user = await getCurrentUser();
  return <Sidebar userEmail={user?.email ?? null} />;
}

async function DemoBannerIfDemo() {
  const user = await getCurrentUser();
  return user?.isDemo ? <DemoBanner /> : null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <DemoBannerIfDemo />
      </Suspense>
      <div className="flex flex-1 flex-col md:flex-row">
        <Suspense fallback={<SidebarShell pathname={null} />}>
          <SidebarWithUser />
        </Suspense>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
