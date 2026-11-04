import { Suspense } from "react";
import { Overview } from "@/components/overview";

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-slate-500">Your job search at a glance.</p>
      </header>
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}
