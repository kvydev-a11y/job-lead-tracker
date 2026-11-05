# Job & Lead Tracker

A personal dashboard for running a job search like a pipeline: track every
application by stage, the **hiring managers vs. talent-acquisition partners** you
reach out to, and get nudged to follow up when a thread goes quiet. Designed to
pull signal automatically from Gmail and from AI job agents — with the
automation built in later phases on top of a working manual core.

> Built as a full-stack portfolio project. The interesting engineering is in the
> honest trade-offs (see [Design decisions](#design-decisions)), not just CRUD.

## Features

**Shipped (Phase 1 — works today, no integrations needed):**
- 📋 **Applications pipeline** — drag-and-drop Kanban board (Applied → Screen →
  Phone/HM → Onsite → Offer) plus a sortable list view.
- 👥 **Contact tracking** — per application, log who you reached out to and tag
  each as Hiring Manager / Talent Acquisition / Recruiter / Referral (the one
  thing automation can't reliably infer).
- ⏰ **Follow-up flagging** — any thread with no reply after 7 days is surfaced
  on the dashboard and the card.
- 📊 **Traction by role type** — see which kinds of roles actually advance.
- 🗂️ **Stage history** — a timeline of every pipeline move.

**Roadmap:**
- **Phase 2** — Gmail ingestion: auto-detect application confirmations and
  recruiter replies, auto-populate outreach.
- **Phase 3** — Follow-up engine: a daily job that flags stale threads and
  drafts a follow-up email for your approval (never auto-sends).
- **Phase 4** — Leads inbox + contact discovery: parse lead emails (incl. the
  `[JOBLEADS]` CSVs from Meta Muse) and enrich contacts via Hunter.io / Apollo.
- **Phase 5** — Deeper insights + an MCP connector so agents like Meta Muse can
  plug in.

## Tech stack

- **Next.js 16** (App Router, React Server Components, Cache Components / PPR) + **TypeScript**
- **Prisma 7** ORM with **driver adapters**, on **PostgreSQL** (Neon free tier)
- **Tailwind CSS v4** + **@dnd-kit** for the board
- **Zod** for input validation

## Design decisions

A few choices worth calling out, because they shaped the architecture:

- **LinkedIn has no legitimate API** for reading your own messages/connections,
  and scraping violates its ToS. So LinkedIn reach-outs are tracked via the
  **email notifications** LinkedIn sends (parsed in Phase 2), not by automating
  LinkedIn itself.
- **Contact discovery is app-native, not agent-dependent.** Meta Muse connects
  *outward* to tools (via connectors/MCP) and exposes no API to call it, so the
  apply→contacts loop is driven by this app, with Muse as an *optional*
  collaborator that emails in `[JOBLEADS]` CSVs the app ingests.
- **Enrichment respects free tiers** — Hunter.io's domain search for breadth,
  Apollo CSV import for a few high-value targets, and always a manual fallback,
  all behind one `ContactProvider` interface.
- **String-typed status columns** (not native DB enums) with Zod validation —
  portable, simple SQL and validation that lives in one place (`src/lib/enums.ts`).

## Getting started

Requires Node 20+.

Needs a Postgres database — [Neon](https://neon.com)'s free tier works well
(local dev and production use the same `DATABASE_URL`, just different values).

```bash
npm install                 # installs deps and generates the Prisma client
cp .env.example .env        # paste your Neon DATABASE_URL into it
npm run db:migrate          # apply migrations to the database
npm run seed                # optional: load realistic sample data
npm run dev                 # http://localhost:3000
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Open Prisma Studio (browse the DB) |
| `npm run seed` | Load sample applications, contacts, leads |
| `npm run lint` | Lint |

## Deploying (Vercel + Neon)

Runs free on Vercel Hobby + a Neon free database.

1. **Neon:** create a project, copy the `DATABASE_URL`. Run `npm run db:migrate`
   against it once (locally, with that URL in `.env`).
2. **Vercel:** import the GitHub repo. Add env vars: `DATABASE_URL`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI=https://<app>.vercel.app/api/google/callback`,
   `NEXT_PUBLIC_APP_URL=https://<app>.vercel.app`, `CRON_SECRET` (any random
   string), optional `LEAD_SENDERS` / `SIGNATURE_NAME`.
3. **Google Cloud:** add `https://<app>.vercel.app/api/google/callback` to the
   OAuth client's authorized redirect URIs.
4. Deploy, open the live URL, connect Gmail in Settings, and **Sync**.

`vercel.json` schedules the ingest + follow-up crons daily (Hobby allows daily
crons; use **Sync now** for on-demand). Vercel sends `CRON_SECRET` to cron
requests automatically.

## Gmail ingestion (Phase 2)

Connects a Gmail account (read-only) to auto-populate applications, replies, and
leads. The classifiers are pure functions with a unit-test suite
(`npm run test`), so the parsing logic works without any credentials.

**One-time Google Cloud setup:**

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project.
2. **APIs & Services → Library →** enable the **Gmail API**.
3. **OAuth consent screen →** External, add your own Google account as a **Test user**.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Add redirect URI `http://localhost:3000/api/google/callback` (and your deployed
   URL's `/api/google/callback`).
5. Copy the client ID/secret into `.env`:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   ```

6. Restart, open **Settings → Connect Gmail**, approve, then **Sync now**.

**How it runs:** the `/api/cron/ingest` endpoint pulls new mail and classifies
it (application confirmations → applications; recruiter replies → outreach
updates; LinkedIn notifications & lead emails → the Leads inbox; Muse
`[JOBLEADS]` CSVs → contacts on the matching application). `vercel.json`
schedules it hourly on deploy; locally use the **Sync now** button. Set
`CRON_SECRET` in production to protect the endpoint, and `LEAD_SENDERS` to the
addresses whose mail should be treated as curated leads.

## License

MIT — see [LICENSE](./LICENSE).
