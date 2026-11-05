import { Suspense } from "react";
import { SettingsView } from "@/components/settings-view";

export default function SettingsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">Connect integrations and manage sync.</p>
      </header>
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />}
      >
        <SettingsView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
