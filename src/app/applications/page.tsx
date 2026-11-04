import { Suspense } from "react";
import { ApplicationsView } from "@/components/applications-view";
import { AddApplicationButton } from "@/components/add-application";

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0">
          <div className="mb-2 h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />
        </div>
      ))}
    </div>
  );
}

export default function ApplicationsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-slate-500">
            Drag a card between columns to move it through the pipeline.
          </p>
        </div>
        <AddApplicationButton />
      </header>
      <Suspense fallback={<BoardSkeleton />}>
        <ApplicationsView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
