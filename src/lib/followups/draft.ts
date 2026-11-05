import type { ContactType } from "@/lib/enums";

export type FollowUpContext = {
  contactName: string;
  contactType: ContactType;
  company: string;
  role: string;
  daysSinceOutbound: number;
  channel: "EMAIL" | "LINKEDIN";
  senderName: string;
};

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0];
  if (!n || /^\(.*\)$/.test(n) || n.toLowerCase() === "unknown") return "there";
  return n;
}

/**
 * Generate a polite, personalized follow-up draft. Deterministic and
 * template-based so it runs with no external API; the shape makes it easy to
 * swap in an LLM later (set ANTHROPIC_API_KEY and replace this call).
 */
export function generateFollowUpDraft(ctx: FollowUpContext): { subject: string; body: string } {
  const first = firstName(ctx.contactName);
  const role = ctx.role && ctx.role !== "(role unknown)" ? ctx.role : "the role";
  const subject = `Following up — ${role} at ${ctx.company}`;

  const isRecruiter = ctx.contactType === "RECRUITER" || ctx.contactType === "TALENT_ACQUISITION";
  const isHM = ctx.contactType === "HIRING_MANAGER";

  let middle: string;
  if (isRecruiter) {
    middle =
      `Following up on my application for the ${role} role at ${ctx.company} — I'm still very ` +
      `interested and wanted to check in on where things stand. If it would help, I'm happy to ` +
      `share anything further or find a time to talk.`;
  } else if (isHM) {
    middle =
      `I wanted to follow up on the ${role} role at ${ctx.company}. I'm genuinely excited about ` +
      `the problems your team is working on, and I'd welcome the chance to discuss how my ` +
      `background could contribute. Would you have time for a brief conversation this week?`;
  } else {
    middle =
      `I wanted to follow up on the ${role} role at ${ctx.company}. I remain very interested and ` +
      `would appreciate any update on the process, or the chance to connect briefly.`;
  }

  const body = `Hi ${first},\n\n${middle}\n\nThank you for your time.\n\nBest,\n${ctx.senderName}`;
  return { subject, body };
}
