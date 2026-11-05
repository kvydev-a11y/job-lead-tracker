"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { STAGES, STAGE_META, type Stage } from "@/lib/enums";
import { updateStage } from "@/app/actions/applications";
import { cn } from "@/lib/utils";

export function StageSelect({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      await updateStage(id, next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", STAGE_META[stage].dot)} />
      <select
        value={stage}
        onChange={onChange}
        disabled={pending}
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium outline-none disabled:opacity-50"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_META[s].label}
          </option>
        ))}
      </select>
    </div>
  );
}
