import { describe, it, expect } from "vitest";
import {
  classifyEmail,
  parseJobleadsSubject,
  extractCsvFromBody,
  extractCompany,
  extractRole,
} from "./classifiers";
import { parseGmailMessage, parseAddress } from "./email";
import { parseCsv } from "./csv";
import type { NormalizedEmail } from "./email";

function email(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    id: "m1",
    threadId: "t1",
    from: "someone@example.com",
    fromName: "Someone",
    to: "me@gmail.com",
    subject: "",
    date: new Date("2026-10-01T10:00:00Z"),
    snippet: "",
    bodyText: "",
    inReplyTo: null,
    labelIds: [],
    attachments: [],
    ...overrides,
  };
}

describe("classifyEmail", () => {
  it("detects an application confirmation and extracts company + role", () => {
    const c = classifyEmail(
      email({
        from: "no-reply@stripe.com",
        subject: "Thanks for applying to Stripe",
        bodyText: "We've received your application for the Senior Product Manager role.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toMatch(/stripe/i);
      expect(c.role).toMatch(/senior product manager/i);
    }
  });

  it("extracts company from an ATS sender via the subject", () => {
    const c = classifyEmail(
      email({
        from: "no-reply@us.greenhouse-mail.io",
        subject: "Your application to Notion",
        bodyText: "Thank you for applying. Your application has been received.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toMatch(/notion/i);
      expect(c.domain).toBeNull(); // generic ATS domain is dropped
    }
  });

  it("parses a Muse [JOBLEADS] email with a fenced CSV", () => {
    const body = [
      "Here are the contacts:",
      "```csv",
      "company,company_domain,role,contact_name,title,email,linkedin_url,contact_type,seniority,department,confidence,source,notes",
      "Airtable,airtable.com,Senior PM,Elena Rossi,Head of Product,elena@airtable.com,,hiring_manager,Director,Product,74,apollo,",
      "```",
    ].join("\n");
    const c = classifyEmail(email({ subject: "[JOBLEADS] Airtable — Senior PM", bodyText: body }));
    expect(c.kind).toBe("MUSE_CONTACTS");
    if (c.kind === "MUSE_CONTACTS") {
      expect(c.company).toBe("Airtable");
      expect(c.role).toBe("Senior PM");
      expect(c.rows).toHaveLength(1);
      expect(c.rows[0].email).toBe("elena@airtable.com");
      expect(c.rows[0].contact_type).toBe("hiring_manager");
    }
  });

  it("classifies a LinkedIn message notification", () => {
    const c = classifyEmail(
      email({ from: "messaging-digest-noreply@linkedin.com", subject: "Dana Kim sent you a message" }),
    );
    expect(c.kind).toBe("LINKEDIN");
    if (c.kind === "LINKEDIN") {
      expect(c.action).toBe("message");
      expect(c.person).toBe("Dana Kim");
    }
  });

  it("classifies a LinkedIn accepted-invitation notification", () => {
    const c = classifyEmail(
      email({ from: "invitations@linkedin.com", subject: "Marcus Lee accepted your invitation" }),
    );
    expect(c.kind).toBe("LINKEDIN");
    if (c.kind === "LINKEDIN") expect(c.action).toBe("invite");
  });

  it("treats a human reply on a thread as REPLY", () => {
    const c = classifyEmail(
      email({ from: "priya@stripe.com", subject: "Re: Your application", inReplyTo: "<abc@mail>", snippet: "Let's schedule a call." }),
    );
    expect(c.kind).toBe("REPLY");
    if (c.kind === "REPLY") expect(c.summary).toMatch(/schedule/i);
  });

  it("does not treat a no-reply 'Re:' as a human reply", () => {
    const c = classifyEmail(email({ from: "no-reply@news.example.com", subject: "Re: Your weekly digest" }));
    expect(c.kind).toBe("IGNORED");
  });

  it("classifies a configured lead sender", () => {
    const c = classifyEmail(
      email({ from: "agent@sarthak.jobs", subject: "3 roles for you" }),
      { leadSenders: ["sarthak.jobs"] },
    );
    expect(c.kind).toBe("LEAD");
    if (c.kind === "LEAD") expect(c.source).toBe("SARTHAK");
  });

  it("ignores unrelated mail", () => {
    const c = classifyEmail(email({ from: "newsletter@medium.com", subject: "Today's highlights" }));
    expect(c.kind).toBe("IGNORED");
  });
});

describe("parseJobleadsSubject", () => {
  it("handles em dash, en dash, and hyphen separators", () => {
    expect(parseJobleadsSubject("[JOBLEADS] Stripe — Senior PM")).toEqual({ company: "Stripe", role: "Senior PM" });
    expect(parseJobleadsSubject("[JOBLEADS] Ramp – PM, Growth")).toEqual({ company: "Ramp", role: "PM, Growth" });
    expect(parseJobleadsSubject("[JOBLEADS] Linear - PM")).toEqual({ company: "Linear", role: "PM" });
  });
});

describe("extractCsvFromBody", () => {
  it("finds a fenced csv block", () => {
    const csv = extractCsvFromBody("intro\n```csv\ncompany,company_domain,role\nX,x.com,PM\n```\noutro");
    expect(csv).toContain("company,company_domain,role");
  });
  it("finds a bare block starting at the canonical header", () => {
    const csv = extractCsvFromBody("blah\ncompany,company_domain,role,contact_name\nX,x.com,PM,Jo");
    expect(csv?.startsWith("company,company_domain,role")).toBe(true);
  });
  it("returns null when absent", () => {
    expect(extractCsvFromBody("just a normal email body")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('a,b\n"x, y","she said ""hi"""');
    expect(rows).toEqual([{ a: "x, y", b: 'she said "hi"' }]);
  });
});

describe("parseAddress", () => {
  it("parses name and email", () => {
    expect(parseAddress('"Dana Kim" <dana@ramp.com>')).toEqual({ name: "Dana Kim", email: "dana@ramp.com" });
    expect(parseAddress("bob@x.com")).toEqual({ name: "", email: "bob@x.com" });
  });
});

describe("parseGmailMessage", () => {
  it("decodes a base64url text/plain body and reads headers", () => {
    const raw = {
      id: "m1",
      threadId: "t1",
      snippet: "snip",
      labelIds: ["INBOX"],
      payload: {
        headers: [
          { name: "From", value: "Priya <priya@stripe.com>" },
          { name: "Subject", value: "Hello" },
          { name: "Date", value: "Thu, 01 Oct 2026 10:00:00 +0000" },
        ],
        mimeType: "text/plain",
        body: { data: Buffer.from("Hello world", "utf8").toString("base64url") },
      },
    };
    const parsed = parseGmailMessage(raw as never);
    expect(parsed.from).toBe("priya@stripe.com");
    expect(parsed.subject).toBe("Hello");
    expect(parsed.bodyText).toBe("Hello world");
  });

  it("collects attachments from multipart messages", () => {
    const raw = {
      id: "m2",
      threadId: "t2",
      payload: {
        mimeType: "multipart/mixed",
        headers: [{ name: "From", value: "x@y.com" }],
        parts: [
          { mimeType: "text/plain", body: { data: Buffer.from("body", "utf8").toString("base64url") } },
          { mimeType: "text/csv", filename: "leads.csv", body: { attachmentId: "att1" } },
        ],
      },
    };
    const parsed = parseGmailMessage(raw as never);
    expect(parsed.attachments).toEqual([{ filename: "leads.csv", mimeType: "text/csv", attachmentId: "att1" }]);
    expect(parsed.bodyText).toBe("body");
  });
});

describe("extractCompany / extractRole", () => {
  it("falls back to the sender domain when no pattern matches", () => {
    const c = extractCompany(email({ from: "careers@ramp.com", subject: "Application received", bodyText: "Your application was received." }));
    expect(c).toMatch(/ramp/i);
  });
  it("extracts role from 'application for the X role'", () => {
    const r = extractRole(email({ subject: "Your application for the Staff Engineer role" }));
    expect(r).toBe("Staff Engineer");
  });
});
