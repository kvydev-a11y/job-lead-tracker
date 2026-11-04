"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { Button } from "./field";
import { syncGmailNow, disconnectGmail } from "@/app/actions/gmail";
import type { IngestSummary } from "@/lib/ingest/ingest";

export function GmailControls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<IngestSummary | null>(null);

  function sync() {
    setResult(null);
    startTransition(async () => {
      const summary = await syncGmailNow();
      setResult(summary);
      router.refresh();
    });
  }

  function disconnect() {
    if (!confirm("Disconnect Gmail? Ingestion will stop until you reconnect.")) return;
    startTransition(async () => {
      await disconnectGmail();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={sync} disabled={pending}>
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {pending ? "Syncing…" : "Sync now"}
        </Button>
        <Button variant="ghost" onClick={disconnect} disabled={pending}>
          <Unplug className="h-4 w-4" />
          Disconnect
        </Button>
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          Scanned {result.scanned} new message{result.scanned === 1 ? "" : "s"} —{" "}
          {result.applications} application{result.applications === 1 ? "" : "s"}, {result.replies}{" "}
          repl{result.replies === 1 ? "y" : "ies"}, {result.contacts} contact
          {result.contacts === 1 ? "" : "s"}, {result.leads + result.linkedin} lead
          {result.leads + result.linkedin === 1 ? "" : "s"}.
          {result.errors > 0 && ` ${result.errors} error${result.errors === 1 ? "" : "s"}.`}
        </div>
      )}
    </div>
  );
}
