"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, Input, Label, Select } from "./field";
import { createContact } from "@/app/actions/contacts";
import { CONTACT_TYPES, CONTACT_TYPE_META } from "@/lib/enums";

export function AddContact({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createContact(fd);
      if (res.ok) {
        form.reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-xs">
        <Plus className="h-3.5 w-3.5" />
        Add contact
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-border bg-background p-4"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" name="name" required placeholder="Jane Doe" autoFocus />
        </div>
        <div>
          <Label htmlFor="c-title">Title</Label>
          <Input id="c-title" name="title" placeholder="Director of Product" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-type">Type</Label>
          <Select id="c-type" name="type" defaultValue="RECRUITER">
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTACT_TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="c-channel">Channel</Label>
          <Select id="c-channel" name="channel" defaultValue="EMAIL">
            <option value="EMAIL">Email</option>
            <option value="LINKEDIN">LinkedIn</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" placeholder="jane@company.com" />
        </div>
        <div>
          <Label htmlFor="c-linkedin">LinkedIn URL</Label>
          <Input id="c-linkedin" name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-xs">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="text-xs">
          {pending ? "Saving…" : "Save contact"}
        </Button>
      </div>
    </form>
  );
}
