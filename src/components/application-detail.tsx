import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Link2, Mail, Users, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import {
  CONTACT_TYPE_META,
  OUTREACH_STATUS_META,
  ROLE_TYPE_LABEL,
  SOURCE_LABEL,
  STAGE_META,
  type ContactType,
  type OutreachStatus,
  type RoleType,
  type Source,
  type Stage,
} from "@/lib/enums";
import { isFollowUpDue } from "@/lib/followups";
import { cn } from "@/lib/utils";
import { StageSelect } from "./stage-select";
import { ContactTypeSelect } from "./contact-type-select";
import { AddContact } from "./add-contact";
import { DeleteApplicationButton, DeleteContactButton } from "./delete-buttons";

export async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const userId = await requireUserId();
  const { id } = await params;

  const app = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      contacts: { orderBy: { createdAt: "asc" }, include: { outreaches: true } },
      outreaches: { orderBy: { updatedAt: "desc" } },
      stageEvents: { orderBy: { at: "desc" } },
    },
  });

  if (!app) notFound();

  const stageMeta = STAGE_META[app.stage as Stage];

  return (
    <div>
      <Link
        href="/applications"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        All applications
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{app.company}</h1>
            <p className="mt-0.5 text-slate-500">{app.role}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {ROLE_TYPE_LABEL[app.roleType as RoleType]}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {SOURCE_LABEL[app.source as Source]}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", stageMeta.chip)}>
                {stageMeta.label}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <StageSelect id={app.id} stage={app.stage as Stage} />
            <DeleteApplicationButton id={app.id} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">Applied</dt>
            <dd>{format(app.appliedAt, "MMM d, yyyy")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Domain</dt>
            <dd className="truncate">{app.companyDomain ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Job posting</dt>
            <dd>
              {app.jobUrl ? (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>

        {app.notes && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-slate-400">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {app.notes}
            </p>
          </div>
        )}
      </div>

      {/* Contacts */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-slate-400" />
            Contacts & outreach
            <span className="text-slate-400">({app.contacts.length})</span>
          </h2>
          <AddContact applicationId={app.id} />
        </div>

        {app.contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-slate-400">
            No contacts yet. Add the hiring manager or recruiter you reached out to, or let
            contact discovery populate them (Phase 4).
          </p>
        ) : (
          <ul className="space-y-2">
            {app.contacts.map((c) => {
              const due = c.outreaches.some((o) => isFollowUpDue(o));
              const latest = c.outreaches[0];
              return (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <ContactTypeSelect id={c.id} type={c.type as ContactType} />
                      {due && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                          <Clock className="h-3 w-3" /> follow up
                        </span>
                      )}
                    </div>
                    {c.title && <p className="mt-0.5 text-xs text-slate-500">{c.title}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      )}
                      {c.linkedinUrl && (
                        <a
                          href={c.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          <Link2 className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                      {latest && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 font-medium",
                            OUTREACH_STATUS_META[latest.status as OutreachStatus].chip,
                          )}
                        >
                          {OUTREACH_STATUS_META[latest.status as OutreachStatus].label}
                        </span>
                      )}
                    </div>
                  </div>
                  <DeleteContactButton id={c.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Stage history */}
      {app.stageEvents.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">Stage history</h2>
          <ol className="space-y-2 border-l border-border pl-4">
            {app.stageEvents.map((ev) => (
              <li key={ev.id} className="relative text-sm">
                <span
                  className={cn(
                    "absolute -left-[21px] top-1.5 h-2 w-2 rounded-full",
                    STAGE_META[ev.toStage as Stage].dot,
                  )}
                />
                <span className="font-medium">{STAGE_META[ev.toStage as Stage].label}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {format(ev.at, "MMM d, yyyy · h:mm a")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
