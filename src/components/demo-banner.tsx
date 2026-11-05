// Shown across the app only when signed in as the demo account.
const DEMO_LINKEDIN_URL = "https://www.linkedin.com/in/kavyadevarapalli/";

export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <span>
        <span className="font-medium">Demo mode</span> — everything here is sample data, not real.
      </span>
      <span>
        Want your own test account?{" "}
        <a
          href={DEMO_LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          Message me on LinkedIn
        </a>
        .
      </span>
    </div>
  );
}
