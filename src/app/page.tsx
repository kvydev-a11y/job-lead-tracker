import Link from "next/link";
import { Briefcase, KanbanSquare, Mail, Clock, Inbox } from "lucide-react";
import { DemoButton } from "@/components/demo-button";

const FEATURES = [
  { icon: KanbanSquare, title: "Pipeline board", body: "Track every application by stage, drag to move it along." },
  { icon: Mail, title: "Gmail ingestion", body: "Auto-detect applications and tell rejections from confirmations." },
  { icon: Clock, title: "Follow-up engine", body: "Get nudged after 7 days of silence — with a draft ready." },
  { icon: Inbox, title: "Lead inbox", body: "Recommendations from AI job agents, triaged in one place." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Briefcase className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Job &amp; Lead Tracker</span>
      </div>

      <h1 className="mt-10 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
        Run your job search like a <span className="text-sky-500">pipeline.</span>
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate-500 md:text-lg">
        A personal tracker that pulls applications and recruiter replies from your inbox, flags
        rejections, and drafts your follow-ups — so nothing slips.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Log in
        </Link>
        <DemoButton />
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <Icon className="h-5 w-5 text-slate-400" />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
          </div>
        ))}
      </div>

      <p className="mt-14 text-xs text-slate-400">
        Your data is private to your account. The demo uses sample data only.
      </p>
    </div>
  );
}
