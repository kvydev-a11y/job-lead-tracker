import { Suspense } from "react";
import { ContactsView } from "@/components/contacts-view";

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-slate-500">
          Everyone you&apos;ve reached out to, across all applications.
        </p>
      </header>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/50" />}
      >
        <ContactsView />
      </Suspense>
    </div>
  );
}
