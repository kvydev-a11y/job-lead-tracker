import { Suspense } from "react";
import { ApplicationDetail } from "@/components/application-detail";

export default function ApplicationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />
        }
      >
        <ApplicationDetail params={props.params} />
      </Suspense>
    </div>
  );
}
