"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteApplication } from "@/app/actions/applications";
import { deleteContact } from "@/app/actions/contacts";
import { Button } from "./field";

export function DeleteApplicationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      className="text-xs"
      onClick={() => {
        if (!confirm("Delete this application and all its contacts? This cannot be undone.")) return;
        startTransition(() => deleteApplication(id));
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

export function DeleteContactButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this contact?")) return;
        startTransition(async () => {
          await deleteContact(id);
          router.refresh();
        });
      }}
      className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40"
      aria-label="Remove contact"
      title="Remove contact"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
