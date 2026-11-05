import { connection } from "next/server";
import { Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { parseStoredDraft } from "@/lib/followups/engine";
import type { ContactType } from "@/lib/enums";
import { FollowUpItem, type FollowUpItemData } from "./followup-item";
import { CheckFollowUpsButton } from "./check-followups-button";

export async function FollowUpsPanel() {
  await connection();
  const stale = await prisma.outreach.findMany({
    where: { status: "STALE" },
    include: { contact: true, application: true },
    orderBy: { followUpDueAt: "asc" },
  });

  const items: FollowUpItemData[] = stale.map((o) => {
    const d = parseStoredDraft(o.draftFollowUp);
    return {
      id: o.id,
      company: o.application.company,
      role: o.application.role,
      contactName: o.contact?.name ?? "Unknown contact",
      contactType: (o.contact?.type ?? "OTHER") as ContactType,
      contactEmail: o.contact?.email ?? null,
      draftSubject: d?.subject ?? `Following up — ${o.application.role} at ${o.application.company}`,
      draftBody: d?.body ?? "",
      pushedAt: d?.pushedAt ?? null,
    };
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-rose-400" />
          Follow-ups due
          {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
        </h2>
        <CheckFollowUpsButton />
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">
          Nothing waiting on a reply past 7 days. Drafts appear here once a tracked outreach goes
          quiet — hit <span className="font-medium">Check now</span> after a sync.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <FollowUpItem key={it.id} item={it} />
          ))}
        </ul>
      )}
    </section>
  );
}
