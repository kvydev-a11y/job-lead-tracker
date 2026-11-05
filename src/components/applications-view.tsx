import { connection } from "next/server";
import Link from "next/link";
import { KanbanSquare, List, Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { anyFollowUpDue } from "@/lib/followups";
import { cn } from "@/lib/utils";
import type { RoleType, Source, Stage } from "@/lib/enums";
import { Board, type AppCard } from "./board";
import { ApplicationsList, type AppRow } from "./applications-list";

function ViewToggle({ view }: { view: "board" | "list" }) {
  const item = (v: "board" | "list", label: string, Icon: typeof List) => (
    <Link
      href={`/applications?view=${v}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        view === v
          ? "bg-card text-slate-900 shadow-sm dark:text-white"
          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
  return (
    <div className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-slate-100 p-1 dark:bg-slate-800">
      {item("board", "Board", KanbanSquare)}
      {item("list", "List", List)}
    </div>
  );
}

export async function ApplicationsView({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  await connection();
  const userId = await requireUserId();
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "board";

  const apps = await prisma.application.findMany({
    where: { userId },
    orderBy: { stageUpdatedAt: "desc" },
    include: {
      _count: { select: { contacts: true } },
      outreaches: { select: { status: true, lastOutboundAt: true, lastInboundAt: true } },
    },
  });

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No applications yet</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Add your first with the button above, or seed sample data with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">npm run seed</code>.
        </p>
      </div>
    );
  }

  const cards: AppCard[] = apps.map((a) => ({
    id: a.id,
    company: a.company,
    role: a.role,
    roleType: a.roleType as RoleType,
    stage: a.stage as Stage,
    appliedAt: a.appliedAt.toISOString(),
    contactCount: a._count.contacts,
    followUpDue: anyFollowUpDue(a.outreaches),
  }));

  const rows: AppRow[] = apps.map((a) => ({
    id: a.id,
    company: a.company,
    role: a.role,
    roleType: a.roleType as RoleType,
    source: a.source as Source,
    stage: a.stage as Stage,
    appliedAt: a.appliedAt.toISOString(),
    contactCount: a._count.contacts,
    followUpDue: anyFollowUpDue(a.outreaches),
  }));

  return (
    <>
      <ViewToggle view={view} />
      {view === "board" ? <Board initial={cards} /> : <ApplicationsList apps={rows} />}
    </>
  );
}
