import { describe, it, expect } from "vitest";
import { generateFollowUpDraft, type FollowUpContext } from "./draft";

function ctx(overrides: Partial<FollowUpContext> = {}): FollowUpContext {
  return {
    contactName: "Dana Kim",
    contactType: "RECRUITER",
    company: "Ramp",
    role: "Product Manager, Growth",
    daysSinceOutbound: 9,
    channel: "EMAIL",
    senderName: "Kavya",
    ...overrides,
  };
}

describe("generateFollowUpDraft", () => {
  it("addresses the contact by first name and signs off with the sender", () => {
    const d = generateFollowUpDraft(ctx());
    expect(d.body.startsWith("Hi Dana,")).toBe(true);
    expect(d.body.trimEnd().endsWith("Best,\nKavya")).toBe(true);
  });

  it("subject names the role and company", () => {
    const d = generateFollowUpDraft(ctx());
    expect(d.subject).toBe("Following up — Product Manager, Growth at Ramp");
  });

  it("recruiter drafts ask about status; HM drafts propose a conversation", () => {
    const recruiter = generateFollowUpDraft(ctx({ contactType: "TALENT_ACQUISITION" }));
    expect(recruiter.body).toMatch(/where things stand/i);

    const hm = generateFollowUpDraft(ctx({ contactType: "HIRING_MANAGER" }));
    expect(hm.body).toMatch(/brief conversation/i);
  });

  it("falls back gracefully for unknown name and role", () => {
    const d = generateFollowUpDraft(ctx({ contactName: "(unknown)", role: "(role unknown)" }));
    expect(d.body.startsWith("Hi there,")).toBe(true);
    expect(d.subject).toBe("Following up — the role at Ramp");
  });
});
