"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./field";
import { runFollowUpScanAction } from "@/app/actions/followups";

export function CheckFollowUpsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {note && <span className="text-xs text-slate-400">{note}</span>}
      <Button
        variant="ghost"
        className="text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const s = await runFollowUpScanAction();
            setNote(s.flagged > 0 ? `${s.flagged} flagged` : "none due");
            router.refresh();
          })
        }
      >
        <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {pending ? "Checking…" : "Check now"}
      </Button>
    </div>
  );
}
