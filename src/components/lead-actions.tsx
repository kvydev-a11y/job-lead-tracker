"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "./field";
import { convertLead, dismissLead } from "@/app/actions/leads";

export function LeadActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={pending}
        className="text-xs"
        onClick={() =>
          startTransition(async () => {
            const res = await convertLead(id);
            if (res.ok && res.id) router.push(`/applications/${res.id}`);
            else router.refresh();
          })
        }
      >
        Convert <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        className="text-xs"
        onClick={() =>
          startTransition(async () => {
            await dismissLead(id);
            router.refresh();
          })
        }
      >
        <X className="h-3.5 w-3.5" />
        Dismiss
      </Button>
    </div>
  );
}
