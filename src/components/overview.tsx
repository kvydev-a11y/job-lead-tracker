import Link from "next/link";
import { connection } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock, Send, Trophy, Layers, Activity } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { isFollowUpDue } from "@/lib/followups";
import {
  CLOSED_STAGES,
  STAGE_META,
  ROLE_TYPE_LABEL,
  type RoleType,
  type Stage,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof Clock;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <Icon className={cn("h-4 w-4 text-slate-300", accent)} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export async function Overview() {
  await connection();
  const userId = await requireUserId();

  const apps = await prisma.application.findMany({
    where: { userId },
    orderBy: { stageUpdatedAt: "desc" },
    include: {
      outreaches: { select: { status: true, lastOutboundAt: true, lastInboundAt: true } },
    },
  });

  const closed = new Set<Stage>(CLOSED_STAGES);
  const total = apps.length;
  const active = apps.filter((a) => !closed.has(a.stage as Stage)).length;
  const inProgress = apps.filter((a) =>
    (["SCREEN", "PHONE", "ONSITE"] as Stage[]).includes(a.stage as Stage),
  ).length;
  const offers = apps.filter((a) => a.stage === "OFFER").length;
  const followUps = apps.filter((a) => a.outreaches.some((o) => isFollowUpDue(o)));

  // Role-type traction: count + how many reached past APPLIED.
  const byRole = new Map<RoleType, { total: number; advanced: number }>();
  for (const a of apps) {
    const rt = a.roleType as RoleType;
    const cur = byRole.get(rt) ?? { total: 0, advanced: 0 };
    cur.total += 1;
    if (!(["APPLIED", "REJECTED", "GHOSTED"] as Stage[]).includes(a.stage as Stage)) cur.advanced += 1;
    byRole.set(rt, cur);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total" value={total} icon={Layers} />
        <Stat label="Active" value={active} icon={Activity} accent="text-sky-400" />
        <Stat label="In progress" value={inProgress} icon={Send} accent="text-violet-400" />
        <Stat label="Offers" value={offers} icon={Trophy} accent="text-emerald-400" />
        <Stat
          label="Follow-ups due"
          value={followUps.length}
          icon={Clock}
          accent={followUps.length > 0 ? "text-rose-400" : undefined}
        />
      </div>

      <div className="grid gap-6">
        {/* Traction by role type */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Traction by role type</h2>
          {byRole.size === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No applications yet.</p>
          ) : (
            <ul className="space-y-3">
              {[...byRole.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([rt, s]) => {
                  const pct = s.total ? Math.round((s.advanced / s.total) * 100) : 0;
                  return (
                    <li key={rt}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{ROLE_TYPE_LABEL[rt]}</span>
                        <span className="text-slate-400">
                          {s.advanced}/{s.total} advanced · {pct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-slate-900 dark:bg-white"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </div>

      {/* Recent activity */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link href="/applications" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
            View all
          </Link>
        </div>
        {apps.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No applications yet — add one from the Applications tab.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {apps.slice(0, 6).map((a) => {
              const meta = STAGE_META[a.stage as Stage];
              return (
                <li key={a.id}>
                  <Link
                    href={`/applications/${a.id}`}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                      <span className="text-sm font-medium">{a.company}</span>
                      <span className="text-xs text-slate-400">{a.role}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNowStrict(a.stageUpdatedAt, { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
