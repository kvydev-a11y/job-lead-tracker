"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Modal } from "./modal";
import { Button, Input, Label, Select, Textarea } from "./field";
import { createApplication } from "@/app/actions/applications";
import { ROLE_TYPES, ROLE_TYPE_LABEL, SOURCES, SOURCE_LABEL } from "@/lib/enums";

export function AddApplicationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Default the date to today, computed on the client when the dialog opens
  // (never during the server prerender, which Cache Components disallows).
  const [appliedAt, setAppliedAt] = useState("");
  useEffect(() => {
    if (open) setAppliedAt(new Date().toISOString().slice(0, 10));
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createApplication(fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add application
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add application">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="company">Company *</Label>
              <Input id="company" name="company" required placeholder="Stripe" autoFocus />
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Input id="role" name="role" required placeholder="Senior PM, Payments" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="roleType">Role type</Label>
              <Select id="roleType" name="roleType" defaultValue="PM">
                {ROLE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_TYPE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <Select id="source" name="source" defaultValue="MANUAL">
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="appliedAt">Applied on</Label>
              <Input
                id="appliedAt"
                name="appliedAt"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="companyDomain">Company domain</Label>
              <Input id="companyDomain" name="companyDomain" placeholder="stripe.com" />
            </div>
          </div>

          <div>
            <Label htmlFor="jobUrl">Job posting URL</Label>
            <Input id="jobUrl" name="jobUrl" type="url" placeholder="https://…" />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Referral from…, team, comp, anything." />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save application"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
