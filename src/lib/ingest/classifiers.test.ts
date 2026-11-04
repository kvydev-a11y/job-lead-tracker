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

// Cases drawn from real inbox formats (Workday, iCIMS, Oracle, Apple, Sarthak).
describe("classifyEmail — real-world formats", () => {
  it("Workday confirmation: company from body 'at X', strips 'Services Inc' + req id", () => {
    const c = classifyEmail(
      email({
        from: "jj@myworkday.com",
        fromName: "Workday Notification",
        subject: "We’ve received your application",
        bodyText:
          "Hi Kavya, We've received your application for Senior Manager, Commercial Data & Insights R-081553 at Johnson & Johnson Services Inc. Thanks so much for your interest.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toBe("Johnson & Johnson");
      expect(c.role).toBe("Senior Manager, Commercial Data & Insights");
      expect(c.rejected).toBe(false);
      expect(c.domain).toBeNull();
    }
  });

  it("iCIMS: company from the 'Acme @ icims' display name", () => {
    const c = classifyEmail(
      email({
        from: "chla+autoreply@talent.icims.com",
        fromName: "Children's Hospital Los Angeles  @ icims",
        subject: "Thank you for applying at Children's Hospital Los Angeles",
        bodyText: "Dear Kavya, Thank you very much for your recent application to the Sr. Product Manager position at Children's Hospital Los Angeles.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") expect(c.company).toBe("Children's Hospital Los Angeles");
  });

  it("distinguishes a rejection from a confirmation", () => {
    const c = classifyEmail(
      email({
        from: "athenahealth@myworkday.com",
        subject: "Thank you for your interest in athenahealth",
        bodyText:
          "Hi Kavya, Thank you for your interest in joining athenahealth. After reviewing your application for the R15470 Senior Product Manager - AI Trust & Transparency position, we have made the decision not to move forward with your candidacy.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.rejected).toBe(true);
      expect(c.company).toBe("athenahealth");
      expect(c.role).toBe("Senior Product Manager - AI Trust & Transparency"); // leading R15470 stripped
    }
  });

  it("does NOT mark a confirmation rejected just because it says 'unfortunately'", () => {
    const c = classifyEmail(
      email({
        from: "salesforce@myworkday.com",
        subject: "Update on your application",
        bodyText:
          "Hi Kavya, Thank you for your interest in Salesforce. Thanks for applying to the Senior Product Manager, Emerging Technology position. Unfortunately, due to volume we can't respond to every applicant individually, but our team is reviewing your application.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.rejected).toBe(false);
      expect(c.company).toBe("Salesforce");
    }
  });

  it("conditional 'if you are not selected' in a confirmation stays Applied", () => {
    const c = classifyEmail(
      email({
        from: "DeltaDental@workflow.email.us-phoenix-1.ocs.oraclecloud.com",
        subject: "Delta Dental: Your recent job application for Senior Data Program Consultant - 3525",
        bodyText:
          "Hello Kavya, Thank you for your interest in Delta Dental! We have successfully received your application for the Senior Data Program Consultant role and appreciate the time you took to apply. If you are not selected for this position, please check our career site.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.rejected).toBe(false);
      expect(c.company).toBe("Delta Dental");
      expect(c.role).toBe("Senior Data Program Consultant");
    }
  });

  it("Expedia rejection: real role (not 'another' from 'apply for another role')", () => {
    const c = classifyEmail(
      email({
        from: "expedia@myworkday.com",
        subject: "Thank you for your interest in Expedia Group",
        bodyText:
          "Hi Kavya, Thank You for taking time to apply for the Principal Product Manager, Brand Expedia AI Experiences position. We're grateful for your interest in Expedia Group. After reviewing your application, we've decided to move forward with other candidates. We hope you'll consider applying for another role at Expedia Group.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.rejected).toBe(true);
      expect(c.role).toBe("Principal Product Manager, Brand Expedia AI Experiences");
    }
  });

  it("Intuitive 'Applying to the {Role} at {Company}' → company Intuitive, not the role", () => {
    const c = classifyEmail(
      email({
        from: "notification@careers.intusurg.com",
        fromName: "Intuitive",
        subject: "Thank You for Applying to the Product Manager at Intuitive.",
        bodyText: "Hi Kavya, On behalf of the Intuitive team, we would like to say THANK YOU!",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toBe("Intuitive");
      expect(c.role).toBe("Product Manager");
    }
  });

  it("Workday 'application for: <reqid> <Role> (Open)' → role without id/suffix", () => {
    const c = classifyEmail(
      email({
        from: "cvshealth@myworkday.com",
        subject: "Your application with Oak Street Health has been received!",
        bodyText:
          "Dear Kavya, Thank you for your interest in joining Oak Street Health! We've successfully received your application for: R1080292 Senior Manager - Digital Product (Risk Modeling) (Open) To check status...",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toBe("Oak Street Health");
      expect(c.role).toBe("Senior Manager - Digital Product (Risk Modeling)");
    }
  });

  it("does not treat an out-of-office auto-reply as a human reply", () => {
    const c = classifyEmail(
      email({
        from: "stewart.campbell@cvshealth.com",
        subject: "Automatic reply: [EXTERNAL] Interest in CVS Health - virtual coffee chat?",
        inReplyTo: "<x@mail>",
        bodyText: "Hello - I am out of the office today and returning tomorrow.",
      }),
    );
    expect(c.kind).toBe("IGNORED");
  });

  it("Sarthak job-match report: detected by signature, company + multiple roles", () => {
    const c = classifyEmail(
      email({
        from: "sarthaksgsits@gmail.com",
        fromName: "Sarthak Bichhawa",
        subject: "Microsoft job matches for Kavya — November 3",
        bodyText:
          "Microsoft job matches for Kavya\n\nThis is an automated job-match report. Sarthak has not reviewed these recommendations yet.\n\n1. Principal Product Management Lead – Analytics · 200061916\n2. Principal Product Manager, capacity intelligence · 200047844\n3. Senior Product Manager, Microsoft Purview · 200063760",
      }),
    );
    expect(c.kind).toBe("LEAD");
    if (c.kind === "LEAD") {
      expect(c.source).toBe("SARTHAK");
      expect(c.company).toBe("Microsoft");
      expect(c.roles).toHaveLength(3);
      expect(c.roles[0]).toBe("Principal Product Management Lead – Analytics");
    }
  });

  it("Apple: 'Thanks for your interest' + resume role with trailing req number", () => {
    const c = classifyEmail(
      email({
        from: "appleworldwiderecruiting@email.apple.com",
        subject: "Thanks for your interest in Apple.",
        bodyText: "Hi Kavya, We just received your resume for the following role: Conversational Commerce Program Manager 200689354. Thanks for thinking of us.",
      }),
    );
    expect(c.kind).toBe("APPLICATION");
    if (c.kind === "APPLICATION") {
      expect(c.company).toBe("Apple");
      expect(c.role).toBe("Conversational Commerce Program Manager");
    }
  });

  it("ignores job-board digests (Haystack)", () => {
    const c = classifyEmail(
      email({ from: "matches@updates.haystackapp.io", fromName: "Haystack", subject: "5 new jobs to approve" }),
    );
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
