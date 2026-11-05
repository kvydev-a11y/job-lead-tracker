import { Suspense } from "react";
import { LeadsView } from "@/components/leads-view";

export default function LeadsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-slate-500">
          Incoming recommendations and contacts to triage into applications.
        </p>
      </header>
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />}
      >
        <LeadsView />
      </Suspense>
    </div>
  );
}
