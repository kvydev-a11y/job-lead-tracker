import Link from "next/link";
import { connection } from "next/server";
import { Mail, Link2, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { ContactTypeSelect } from "./contact-type-select";
import type { ContactType } from "@/lib/enums";

export async function ContactsView() {
  await connection();

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    include: { application: { select: { id: true, company: true, role: true } } },
  });

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <Users className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">No contacts yet</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Add contacts from any application&apos;s detail page. They&apos;ll roll up here across
          all your applications.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Company / Role</th>
            <th className="px-4 py-3 font-medium">Reach</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr
              key={c.id}
              className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <td className="px-4 py-3">
                <p className="font-medium">{c.name}</p>
                {c.title && <p className="text-xs text-slate-500">{c.title}</p>}
              </td>
              <td className="px-4 py-3">
                <ContactTypeSelect id={c.id} type={c.type as ContactType} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/applications/${c.application.id}`}
                  className="hover:underline"
                >
                  <span className="font-medium">{c.application.company}</span>
                  <span className="block text-xs text-slate-500">{c.application.role}</span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 text-slate-500">
                  {c.email && (
                    <a href={`mailto:${c.email}`} title={c.email} className="hover:text-slate-700 dark:hover:text-slate-300">
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300">
                      <Link2 className="h-4 w-4" />
                    </a>
                  )}
                  {!c.email && !c.linkedinUrl && <span className="text-slate-300">—</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
