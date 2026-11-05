"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CONTACT_TYPES, CONTACT_TYPE_META, type ContactType } from "@/lib/enums";
import { updateContactType } from "@/app/actions/contacts";
import { cn } from "@/lib/utils";

export function ContactTypeSelect({ id, type }: { id: string; type: ContactType }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      await updateContactType(id, next);
      router.refresh();
    });
  }

  return (
    <select
      value={type}
      onChange={onChange}
      disabled={pending}
      className={cn(
        "cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none disabled:opacity-50",
        CONTACT_TYPE_META[type].chip,
      )}
      title="Set contact type"
    >
      {CONTACT_TYPES.map((t) => (
        <option key={t} value={t}>
          {CONTACT_TYPE_META[t].label}
        </option>
      ))}
    </select>
  );
}
