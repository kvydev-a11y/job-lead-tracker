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
  | { kind: "APPLICATION"; company: string; role: string | null; domain: string | null }
  | { kind: "REPLY"; threadId: string; summary: string }
  | { kind: "LINKEDIN"; person: string | null; action: "message" | "invite" | "inmail" | "other" }
  | { kind: "LEAD"; source: "SARTHAK" | "MUSE" | "OTHER"; company: string | null; role: string | null }
  | { kind: "MUSE_CONTACTS"; company: string | null; role: string | null; rows: Record<string, string>[] }
  | { kind: "IGNORED" };

export type ClassifyOptions = {
  /** Email addresses or bare domains whose mail is curated job leads. */
  leadSenders?: string[];
};

// Mail infra / ATS / freemail domains that don't name the hiring company.
const GENERIC_DOMAINS = [
  "greenhouse-mail.io", "greenhouse.io", "us.greenhouse-mail.io", "lever.co", "hire.lever.co",
  "myworkday.com", "workday.com", "ashbyhq.com", "smartrecruiters.com", "workable.com",
  "icims.com", "taleo.net", "jobvite.com", "bamboohr.com", "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "yahoo.com", "linkedin.com", "indeed.com", "ziprecruiter.com",
];

const TITLE_SKIP = /\b(inc|llc|ltd|corp|co|gmbh|the)\b/gi;

function domainOf(email: string): string {
  return email.split("@")[1] ?? "";
}

function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.some((g) => domain === g || domain.endsWith("." + g));
}

function titleCaseDomain(domain: string): string {
  const base = domain.split(".").slice(0, -1).join(".").split(".").pop() ?? domain;
  const cleaned = base.replace(/[-_]/g, " ").replace(TITLE_SKIP, "").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isNoReply(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return /no-?reply|do-?not-?reply|notifications?|mailer|automated|careers?|jobs?|talent|recruit/i.test(
    local,
  );
}

const APPLICATION_PATTERNS = [
  /thank you for (your interest|applying)/i,
  /we('| ha)ve received your application/i,
  /your application (has been|was) (received|submitted|sent)/i,
  /application (received|submitted|confirmation)/i,
  /thanks for applying/i,
  /received your application for/i,
];

/** Pull a company name out of an application-confirmation email. */
export function extractCompany(email: NormalizedEmail): string | null {
  const text = `${email.subject}\n${email.bodyText}`;
  const patterns = [
    /appl(?:ication|ying|ied)\s+(?:to|at|with)\s+([A-Z][\w&.,'’\- ]{1,40}?)(?:[.!\n,]|\s+for\b|\s+team\b|\s+has\b|$)/,
    /your application (?:to|at|with)\s+([A-Z][\w&.,'’\- ]{1,40}?)(?:[.!\n,]| for |$)/i,
    /interest in (?:joining |working at )?([A-Z][\w&.,'’\- ]{1,40}?)(?:[.!\n,]| for |$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  const d = domainOf(email.from);
  if (d && !isGenericDomain(d)) return titleCaseDomain(d) || null;
  if (email.fromName && !/no-?reply|team|careers?|talent/i.test(email.fromName)) return email.fromName;
  return null;
}

/** Pull a role/title out of an application-confirmation email. */
export function extractRole(email: NormalizedEmail): string | null {
  const text = `${email.subject}\n${email.bodyText}`;
  const patterns = [
    /appl(?:ication|ying|ied)\s+for\s+(?:the\s+)?(.+?)(?:\s+role|\s+position|\s+at\b|[.!\n]|$)/i,
    /your application for\s+(?:the\s+)?(.+?)(?:\s+role|\s+position|\s+at\b|[.!\n]|$)/i,
    /position:\s*(.+?)(?:[.!\n]|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && m[1].trim().length <= 60) return m[1].trim();
  }
  return null;
}

/** Parse the `[JOBLEADS] <Company> — <Role>` subject convention. */
export function parseJobleadsSubject(subject: string): { company: string | null; role: string | null } {
  const m = subject.match(/^\s*\[JOBLEADS\]\s*(.+?)\s*[—–-]\s*(.+?)\s*$/i);
  if (m) return { company: m[1].trim(), role: m[2].trim() };
  const only = subject.match(/^\s*\[JOBLEADS\]\s*(.+?)\s*$/i);
  return { company: only?.[1]?.trim() ?? null, role: null };
}

/** Extract CSV text from a fenced ```csv block, or a bare block that starts
 *  with the canonical header. Returns null if none found. */
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

export function classifyEmail(email: NormalizedEmail, opts: ClassifyOptions = {}): Classification {
  const subject = email.subject ?? "";
  const from = email.from ?? "";
  const domain = domainOf(from);

  // 1. Muse contact drop — the fixed [JOBLEADS] convention.
  if (/^\s*\[JOBLEADS\]/i.test(subject)) {
    const { company, role } = parseJobleadsSubject(subject);
    const csv = extractCsvFromBody(email.bodyText);
    const rows = csv ? parseCsv(csv) : [];
    return { kind: "MUSE_CONTACTS", company, role, rows };
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

  // 3. Curated lead senders (Sarthak's agent, or a Muse digest).
  const leadSenders = opts.leadSenders ?? [];
  if (leadSenders.some((s) => from === s.toLowerCase() || domain === s.toLowerCase())) {
    const source = /sarthak/i.test(from) ? "SARTHAK" : /muse/i.test(from) ? "MUSE" : "OTHER";
    return { kind: "LEAD", source, company: null, role: null };
  }

  // 4. Application confirmations.
  const haystack = `${subject}\n${email.bodyText}`;
  if (APPLICATION_PATTERNS.some((p) => p.test(haystack))) {
    const company = extractCompany(email);
    if (company) {
      return { kind: "APPLICATION", company, role: extractRole(email), domain: isGenericDomain(domain) ? null : domain };
    }
  }

  // 5. Human replies on an existing thread.
  const isReply = Boolean(email.inReplyTo) || /^re:/i.test(subject);
  if (isReply && !isNoReply(from)) {
    return { kind: "REPLY", threadId: email.threadId, summary: email.snippet.slice(0, 280) };
  }

  return { kind: "IGNORED" };
}
