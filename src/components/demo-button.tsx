"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { demoLogin } from "@/app/actions/auth";

export function DemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        onClick={() =>
          startTransition(async () => {
            const res = await demoLogin();
            if (res.ok) router.push("/overview");
            else setError(res.error);
          })
        }
        disabled={pending}
        className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
      >
        {pending ? "Loading demo…" : "Try the demo"}
      </button>
      {error && <span className="mt-1 text-xs text-rose-600">{error}</span>}
    </span>
  );
}
