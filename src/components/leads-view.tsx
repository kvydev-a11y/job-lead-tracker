import { connection } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { SOURCE_LABEL, type Source } from "@/lib/enums";
import { LeadActions } from "./lead-actions";
import { cn } from "@/lib/utils";

const SOURCE_CHIP: Record<string, string> = {
  SARTHAK: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  MUSE: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  OTHER: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
};

function sourceLabel(source: string): string {
  if (source in SOURCE_LABEL) return SOURCE_LABEL[source as Source];
  return source === "OTHER" ? "LinkedIn / Other" : source;
}

export async function LeadsView() {
  await connection();
  const userId = await requireUserId();
  const leads = await prisma.lead.findMany({
    where: { userId, status: "NEW" },
    orderBy: { createdAt: "desc" },
  });

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No new leads</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Leads from Sarthak&apos;s agent, Muse <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">[JOBLEADS]</code>{" "}
          emails, and LinkedIn notifications land here once Gmail sync is connected.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {leads.map((lead) => {
        let note: string | null = null;
        try {
          const ex = lead.extracted ? JSON.parse(lead.extracted) : null;
          note = ex?.person
            ? `${ex.person}${ex.action ? ` · ${ex.action}` : ""}`
            : ex?.contacts
              ? `${ex.contacts} contact${ex.contacts === 1 ? "" : "s"} attached`
              : ex?.subject ?? null;
        } catch {
          note = null;
        }
        return (
          <li
            key={lead.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SOURCE_CHIP[lead.source] ?? SOURCE_CHIP.OTHER)}>
                  {sourceLabel(lead.source)}
                </span>
                <span className="text-sm font-medium">{lead.company ?? "Untitled lead"}</span>
                {lead.role && <span className="text-xs text-slate-500">{lead.role}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {note ? `${note} · ` : ""}
                {formatDistanceToNowStrict(lead.createdAt, { addSuffix: true })}
              </p>
            </div>
            <LeadActions id={lead.id} />
          </li>
        );
      })}
    </ul>
  );
}
