import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Construction className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium">Arriving in {phase}</p>
        <div className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          {children}
        </div>
      </div>
    </div>
  );
}
