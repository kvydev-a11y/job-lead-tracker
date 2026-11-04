import type { NormalizedEmail } from "./email";
import { parseCsv } from "./csv";

export type EmailKind =
  | "APPLICATION"
  | "REPLY"
  | "LINKEDIN"
  | "LEAD"
  | "MUSE_CONTACTS"
  | "IGNORED";

export type Classification =
  | { kind: "APPLICATION"; company: string; role: string | null; domain: string | null; rejected: boolean }
  | { kind: "REPLY"; threadId: string; summary: string }
  | { kind: "LINKEDIN"; person: string | null; action: "message" | "invite" | "inmail" | "other" }
  | { kind: "LEAD"; source: "SARTHAK" | "MUSE" | "OTHER"; company: string | null; roles: string[] }
  | { kind: "MUSE_CONTACTS"; company: string | null; role: string | null; rows: Record<string, string>[] }
  | { kind: "IGNORED" };

export type ClassifyOptions = {
  /** Email addresses or bare domains whose mail is curated job leads. */
  leadSenders?: string[];
};

// Mail infra / ATS / job-board / freemail domains that don't name the company.
const GENERIC_DOMAINS = [
  "greenhouse-mail.io", "greenhouse.io", "us.greenhouse-mail.io", "lever.co", "hire.lever.co",
  "myworkday.com", "workday.com", "ashbyhq.com", "smartrecruiters.com", "workable.com",
  "icims.com", "talent.icims.com", "taleo.net", "jobvite.com", "bamboohr.com", "oraclecloud.com",
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "linkedin.com",
  "indeed.com", "ziprecruiter.com", "haystackapp.io", "updates.haystackapp.io",
];

const COMPANY_SUFFIX = /\s*(?:,?\s*(?:inc|llc|ltd|corp|co|gmbh|services inc)\.?)\s*$/i;

function stripZeroWidth(s: string): string {
  return s.replace(/[​-‏‪-‮⁠﻿]/g, "");
}

function cleanCompany(raw: string): string {
  return stripZeroWidth(raw).replace(/[®™]/g, "").replace(COMPANY_SUFFIX, "").replace(/[\s.,!]+$/, "").trim();
}

function domainOf(email: string): string {
  return email.split("@")[1] ?? "";
}

function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.some((g) => domain === g || domain.endsWith("." + g));
}

function titleCaseDomain(domain: string): string {
  const base = domain.split(".").slice(0, -1).pop() ?? domain;
  const cleaned = base.replace(/[-_]/g, " ").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isNoReply(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return /no-?reply|do-?not-?reply|notifications?|mailer|automated|careers?|jobs?|talent|recruit/i.test(local);
}

const APPLICATION_PATTERNS = [
  /thank you for (your interest|applying)/i,
  /we('| ha)ve (successfully )?received your application/i,
  /we received your (job )?application/i,
  /your (job )?application (with|to|for) .{0,60}?(has been|was|is) (received|submitted|sent)/i,
  /your (recent )?(job )?application for/i,
  /thanks? (so much )?for applying/i,
  /received your (application|resume) for/i,
  /thank you for your (recent )?application/i,
];

const REJECTION_PATTERNS =
  /not (?:to|be) mov(?:e|ing) forward|decided not to (?:move|proceed|continue)|will not be (?:moving|proceeding)|move forward with other|pursue other candidate|not (?:be )?(?:selected|moving forward)|position has (?:been|since been) filled|unfortunately/i;

/** Pull a company name out of an application-confirmation email. */
export function extractCompany(email: NormalizedEmail): string | null {
  // iCIMS and similar put the company in the display name: "Acme @ icims".
  const dn = email.fromName.match(/^(.+?)\s*@\s*(?:icims|workday|greenhouse|lever)/i);
  if (dn?.[1]) return cleanCompany(dn[1]);

  const text = stripZeroWidth(`${email.subject}\n${email.bodyText}`);
  const patterns = [
    /thank you for applying (?:at|to)\s+([A-Za-z][\w&.,'’\-() ]{1,45}?)(?:[.!\n]|$)/i,
    /your application (?:with|to)\s+([A-Za-z][\w&.,'’\-() ]{1,45}?)\s+(?:has been|was|is)\b/i,
    /\bapplication (?:to|with)\s+(?!the\b)([A-Z][\w&.'’\- ]{1,45}?)(?:\s+(?:has been|was|is|received)\b|[.!\n]|$)/,
    /thank(?:s| you) for your interest in (?:joining\s+)?([A-Za-z][\w&.,'’\-() ]{1,45}?)(?:[.!®\n]|$)/i,
    /application to (?:the\s+)?[\w,\-.() ]+?\s+position at\s+([A-Za-z][\w&.,'’\-() ]{1,45}?)(?:[.!\n]|$)/i,
    /received your application for .*?\bat\s+([A-Za-z][\w&.,'’\-() ]{1,45}?)(?:[.!\n]|$)/i,
    /interest in\s+([A-Za-z][\w&.,'’\-() ]{1,45}?)[!]/,
    /^([A-Za-z][\w&.,'’\-() ]{1,45}?):\s+Your recent job application/i,
    /\bat\s+([A-Z][\w&.'’\-() ]{1,45}?)\.?\s*$/m, // "... at Intuitive." (subject tail)
  ];
  for (const p of patterns) {
    const m = text.match(p);
    const c = m?.[1] ? cleanCompany(m[1]) : "";
    if (c && c.length >= 2 && c.length <= 45) return c;
  }

  const d = domainOf(email.from);
  if (d.endsWith("oraclecloud.com")) {
    const local = email.from.split("@")[0];
    if (local) return local.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").trim();
  }
  if (d && !isGenericDomain(d)) return titleCaseDomain(d) || null;
  return null;
}

/** Pull a role/title out of an application-confirmation email. */
export function extractRole(email: NormalizedEmail): string | null {
  const text = stripZeroWidth(`${email.subject}\n${email.bodyText}`);
  const patterns = [
    /thank you for applying to the\s+(.+?)\s+at\b/i,
    /appl(?:ication|ying)\s+(?:to|for)\s+(?:the\s+)?(.+?)\s+(?:position|role)\b/i,
    /received your (?:application|resume) for(?:\s+the following role:)?\s+(.+?)(?:[.!\n]|$)/i,
    /(?:recent )?(?:job )?application for\s+(?:the\s+)?(.+?)(?:\s+-\s*\d+|[.!\n]|$)/i,
    /your application for\s+(?:the\s+)?(.+?)(?:\s+role|\s+position|\s+at\b|[.!\n]|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m?.[1]) continue;
    const role = cleanRole(m[1]);
    if (role && role.length >= 2 && role.length <= 70) return role;
  }
  return null;
}

function cleanRole(raw: string): string {
  return stripZeroWidth(raw)
    .replace(/\s+at\s+[A-Z].*$/, "") // trailing "at Company"
    .replace(/\s*\(Open\)\s*$/i, "")
    .replace(/\s+(?:R-?\d+|REQ-?\d+|#?\d{5,}|[A-Z]\d{4,}).*$/i, "") // req ids
    .replace(/\s*[-–·]\s*\d{3,}\s*$/, "") // trailing " - 3525" / " · 200061916"
    .replace(/[\s.,!]+$/, "")
    .trim();
}

/** Parse the `[JOBLEADS] <Company> — <Role>` subject convention. */
export function parseJobleadsSubject(subject: string): { company: string | null; role: string | null } {
  const s = stripZeroWidth(subject);
  const m = s.match(/^\s*\[JOBLEADS\]\s*(.+?)\s*[—–-]\s*(.+?)\s*$/i);
  if (m) return { company: m[1].trim(), role: m[2].trim() };
  const only = s.match(/^\s*\[JOBLEADS\]\s*(.+?)\s*$/i);
  return { company: only?.[1]?.trim() ?? null, role: null };
}

/** Extract CSV from a fenced ```csv block or a bare canonical-header block. */
export function extractCsvFromBody(body: string): string | null {
  const fenced = body.match(/```(?:csv)?\s*\n([\s\S]*?)```/i);
  if (fenced?.[1] && /company/i.test(fenced[1])) return fenced[1].trim();
  const headerIdx = body.search(/^company\s*,\s*company_domain\s*,\s*role/im);
  if (headerIdx !== -1) return body.slice(headerIdx).trim();
  return null;
}

function extractLinkedInPerson(subject: string): string | null {
  const m =
    subject.match(/^(.+?)\s+(?:sent you|accepted|wants to|mentioned|shared|messaged|is now)/i) ||
    subject.match(/(?:message|InMail) from\s+(.+?)[:.]?$/i) ||
    subject.match(/invitation from\s+(.+?)[:.]?$/i);
  return m?.[1]?.trim() ?? null;
}

/** Detect an auto-reply / out-of-office, which is not a genuine human reply. */
export function isAutoReply(email: NormalizedEmail): boolean {
  if (/^\s*(?:automatic reply|auto-?reply|out of office|away)\b/i.test(email.subject)) return true;
  return /\b(out of (?:the )?office|i am (?:currently )?out of office|away from (?:my )?(?:email|desk|office)|on (?:vacation|leave|holiday) (?:until|through))\b/i.test(
    email.bodyText.slice(0, 600),
  );
}

/** Parse a numbered role list from a job-match report body. */
export function parseLeadRoles(body: string): string[] {
  const roles: string[] = [];
  const re = /^\s*\d+\.\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripZeroWidth(body)))) {
    const role = m[1].replace(/\s*[·•\-–]\s*\d{3,}\s*$/, "").trim();
    if (role.length >= 2 && role.length <= 90) roles.push(role);
  }
  return roles;
}

export function classifyEmail(email: NormalizedEmail, opts: ClassifyOptions = {}): Classification {
  const subject = stripZeroWidth(email.subject ?? "");
  const from = email.from ?? "";
  const domain = domainOf(from);
  const body = email.bodyText ?? "";

  // 1. Muse contact drop — the fixed [JOBLEADS] convention.
  if (/^\s*\[JOBLEADS\]/i.test(subject)) {
    const { company, role } = parseJobleadsSubject(subject);
    const csv = extractCsvFromBody(body);
    return { kind: "MUSE_CONTACTS", company, role, rows: csv ? parseCsv(csv) : [] };
  }

  // 2. LinkedIn notification emails.
  if (domain === "linkedin.com" || domain.endsWith(".linkedin.com")) {
    const action: "message" | "invite" | "inmail" | "other" = /inmail/i.test(subject)
      ? "inmail"
      : /accepted your invitation|is now a connection|invitation/i.test(subject)
        ? "invite"
        : /sent you a message|messaged you|new message/i.test(subject)
          ? "message"
          : "other";
    return { kind: "LINKEDIN", person: extractLinkedInPerson(subject), action };
  }

  // 3. Curated job-match reports (Sarthak's agent, a Muse digest, or a
  //    configured sender). Detected by signature even before configuration.
  const leadSenders = opts.leadSenders ?? [];
  const senderMatch = leadSenders.some((s) => from === s.toLowerCase() || domain === s.toLowerCase());
  const isJobMatch = /automated job-match report/i.test(body) || /\bjob match(?:es)?\s+for\b/i.test(subject);
  if (senderMatch || isJobMatch) {
    const source: "SARTHAK" | "MUSE" | "OTHER" = /sarthak/i.test(from) || /sarthak/i.test(body)
      ? "SARTHAK"
      : /muse/i.test(from)
        ? "MUSE"
        : "OTHER";
    const companyM = subject.match(/^(.+?)\s+job match(?:es)?\s+for\b/i);
    const company = companyM?.[1] ? cleanCompany(companyM[1]) : null;
    return { kind: "LEAD", source, company, roles: parseLeadRoles(body) };
  }

  // 4. Application confirmations (and ATS rejections).
  const haystack = stripZeroWidth(`${subject}\n${body}`);
  if (APPLICATION_PATTERNS.some((p) => p.test(haystack))) {
    const company = extractCompany(email);
    if (company) {
      return {
        kind: "APPLICATION",
        company,
        role: extractRole(email),
        domain: isGenericDomain(domain) ? null : domain,
        rejected: REJECTION_PATTERNS.test(haystack),
      };
    }
  }

  // 5. Human replies on an existing thread (auto-replies excluded).
  const isReply = Boolean(email.inReplyTo) || /^re:/i.test(subject);
  if (isReply && !isNoReply(from) && !isAutoReply(email)) {
    return { kind: "REPLY", threadId: email.threadId, summary: email.snippet.slice(0, 280) };
  }

  return { kind: "IGNORED" };
}
