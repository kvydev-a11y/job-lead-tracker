// Central definition of the string-typed "enum" domains used across the app.
// Kept in code (not as native DB enums) so the schema runs on SQLite locally
// and swaps to Postgres cleanly. Each has a Zod schema for validation.
import { z } from "zod";

// ---- Stage (application pipeline) ----
export const STAGES = [
  "APPLIED",
  "SCREEN",
  "PHONE",
  "ONSITE",
  "OFFER",
  "REJECTED",
  "GHOSTED",
] as const;
export type Stage = (typeof STAGES)[number];
export const StageSchema = z.enum(STAGES);

/** Columns shown as the active pipeline (closed stages rendered separately). */
export const PIPELINE_STAGES: Stage[] = [
  "APPLIED",
  "SCREEN",
  "PHONE",
  "ONSITE",
  "OFFER",
];
export const CLOSED_STAGES: Stage[] = ["REJECTED", "GHOSTED"];

export const STAGE_META: Record<Stage, { label: string; dot: string; chip: string }> = {
  APPLIED: { label: "Applied", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  SCREEN: { label: "Recruiter Screen", dot: "bg-sky-400", chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
  PHONE: { label: "Phone / HM", dot: "bg-violet-400", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" },
  ONSITE: { label: "Onsite / Loop", dot: "bg-amber-400", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  OFFER: { label: "Offer", dot: "bg-emerald-400", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", dot: "bg-rose-400", chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
  GHOSTED: { label: "Ghosted", dot: "bg-zinc-400", chip: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

// ---- Role type ----
export const ROLE_TYPES = ["PM", "EM", "DESIGN", "ENG", "DATA", "OTHER"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];
export const RoleTypeSchema = z.enum(ROLE_TYPES);
export const ROLE_TYPE_LABEL: Record<RoleType, string> = {
  PM: "Product",
  EM: "Eng Management",
  DESIGN: "Design",
  ENG: "Engineering",
  DATA: "Data / Analytics",
  OTHER: "Other",
};

// ---- Application source ----
export const SOURCES = ["LINKEDIN", "REFERRAL", "SITE", "MUSE", "SARTHAK", "MANUAL"] as const;
export type Source = (typeof SOURCES)[number];
export const SourceSchema = z.enum(SOURCES);
export const SOURCE_LABEL: Record<Source, string> = {
  LINKEDIN: "LinkedIn",
  REFERRAL: "Referral",
  SITE: "Company Site",
  MUSE: "Muse",
  SARTHAK: "Sarthak's Agent",
  MANUAL: "Manual",
};

// ---- Contact type (the HM vs TA distinction) ----
export const CONTACT_TYPES = [
  "HIRING_MANAGER",
  "TALENT_ACQUISITION",
  "RECRUITER",
  "REFERRAL",
  "OTHER",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const ContactTypeSchema = z.enum(CONTACT_TYPES);
export const CONTACT_TYPE_META: Record<ContactType, { label: string; chip: string }> = {
  HIRING_MANAGER: { label: "Hiring Manager", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" },
  TALENT_ACQUISITION: { label: "Talent Acquisition", chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
  RECRUITER: { label: "Recruiter", chip: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
  REFERRAL: { label: "Referral", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  OTHER: { label: "Other", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export const CONTACT_CHANNELS = ["EMAIL", "LINKEDIN"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

// ---- Outreach status ----
export const OUTREACH_STATUSES = ["WAITING", "REPLIED", "STALE"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];
export const OUTREACH_STATUS_META: Record<OutreachStatus, { label: string; chip: string }> = {
  WAITING: { label: "Awaiting reply", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  REPLIED: { label: "Replied", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  STALE: { label: "Follow-up due", chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
};

export const FOLLOWUP_DAYS = 7;
