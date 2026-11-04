import type { gmail_v1 } from "googleapis";

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
};

/** A Gmail message flattened into the fields the classifiers care about. */
export type NormalizedEmail = {
  id: string;
  threadId: string;
  from: string; // lowercased email address
  fromName: string;
  to: string;
  subject: string;
  date: Date;
  snippet: string;
  bodyText: string;
  inReplyTo: string | null;
  labelIds: string[];
  attachments: EmailAttachment[];
};

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/** Parse a "Name <email@host>" (or bare address) header. */
export function parseAddress(value: string): { email: string; name: string } {
  const m = value.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] ?? "").trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: value.trim().toLowerCase() };
}

function decodeBody(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Recursively collect the best text body and any attachments. */
function walk(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: { plain: string[]; html: string[]; attachments: EmailAttachment[] },
) {
  if (!part) return;
  const mime = part.mimeType ?? "";
  const filename = part.filename ?? "";
  const body = part.body;

  if (filename && body?.attachmentId) {
    acc.attachments.push({ filename, mimeType: mime, attachmentId: body.attachmentId });
  } else if (mime === "text/plain" && body?.data) {
    acc.plain.push(decodeBody(body.data));
  } else if (mime === "text/html" && body?.data) {
    acc.html.push(decodeBody(body.data));
  }
  for (const child of part.parts ?? []) walk(child, acc);
}

export function parseGmailMessage(msg: gmail_v1.Schema$Message): NormalizedEmail {
  const headers = msg.payload?.headers;
  const from = parseAddress(getHeader(headers, "From"));
  const acc = { plain: [] as string[], html: [] as string[], attachments: [] as EmailAttachment[] };
  walk(msg.payload, acc);

  const bodyText =
    acc.plain.join("\n").trim() ||
    (acc.html.length ? stripHtml(acc.html.join("\n")) : "") ||
    msg.snippet ||
    "";

  const dateHeader = getHeader(headers, "Date");
  const parsedDate = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate ?? Date.now()));

  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    from: from.email,
    fromName: from.name,
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    snippet: msg.snippet ?? "",
    bodyText,
    inReplyTo: getHeader(headers, "In-Reply-To") || null,
    labelIds: msg.labelIds ?? [],
    attachments: acc.attachments,
  };
}
