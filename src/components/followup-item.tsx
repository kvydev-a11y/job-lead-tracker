"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, Check, X } from "lucide-react";
import { Button, Input, Textarea } from "./field";
import { CONTACT_TYPE_META, type ContactType } from "@/lib/enums";
import { approveFollowUp, dismissFollowUp } from "@/app/actions/followups";
import { cn } from "@/lib/utils";

export type FollowUpItemData = {
  id: string;
  company: string;
  role: string;
  contactName: string;
  contactType: ContactType;
  contactEmail: string | null;
  draftSubject: string;
  draftBody: string;
  pushedAt: string | null;
};

export function FollowUpItem({ item }: { item: FollowUpItemData }) {
  const router = useRouter();
  const [subject, setSubject] = useState(item.draftSubject);
  const [body, setBody] = useState(item.draftBody);
  const [error, setError] = useState<string | null>(null);
  const [pushed, setPushed] = useState(Boolean(item.pushedAt));
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await approveFollowUp({ outreachId: item.id, subject, body });
      if (res.ok) {
        setPushed(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissFollowUp(item.id);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium">{item.company}</span>
          <span className="ml-2 text-xs text-slate-500">{item.role}</span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CONTACT_TYPE_META[item.contactType].chip)}>
          {item.contactName} · {CONTACT_TYPE_META[item.contactType].label}
        </span>
      </div>

      {pushed ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Draft created in Gmail — review and send it there.
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-32 text-xs leading-relaxed"
            aria-label="Draft body"
          />
          {!item.contactEmail && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No email on file for this contact — add one to create a Gmail draft.
            </p>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-xs" onClick={dismiss} disabled={pending}>
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
            <Button className="text-xs" onClick={approve} disabled={pending || !item.contactEmail}>
              <Mail className="h-3.5 w-3.5" />
              {pending ? "Working…" : "Create Gmail draft"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
