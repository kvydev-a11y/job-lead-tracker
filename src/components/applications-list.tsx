import Link from "next/link";
import { Clock, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ROLE_TYPE_LABEL,
  SOURCE_LABEL,
  STAGE_META,
  type RoleType,
  type Source,
  type Stage,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

export type AppRow = {
  id: string;
  company: string;
  role: string;
  roleType: RoleType;
  source: Source;
  stage: Stage;
  appliedAt: string;
  contactCount: number;
  followUpDue: boolean;
};

export function ApplicationsList({ apps }: { apps: AppRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">Company / Role</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Applied</th>
            <th className="px-4 py-3 font-medium">Contacts</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => {
            const meta = STAGE_META[a.stage];
            return (
              <tr
                key={a.id}
                className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-3">
                  <Link href={`/applications/${a.id}`} className="block">
                    <span className="flex items-center gap-2 font-medium">
                      {a.company}
                      {a.followUpDue && <Clock className="h-3.5 w-3.5 text-rose-500" />}
                    </span>
                    <span className="text-xs text-slate-500">{a.role}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {ROLE_TYPE_LABEL[a.roleType]}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.chip)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{SOURCE_LABEL[a.source]}</td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDistanceToNowStrict(new Date(a.appliedAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {a.contactCount > 0 ? (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {a.contactCount}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
