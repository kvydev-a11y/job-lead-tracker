import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and dedupe conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Derive a probable email domain from a company name (best-effort, editable). */
export function guessDomain(company: string): string {
  return (
    company
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|co|company|technologies|labs)\b/g, "")
      .replace(/[^a-z0-9]/g, "") + ".com"
  );
}
