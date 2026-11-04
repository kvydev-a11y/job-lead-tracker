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
- **Prisma 7** ORM with **driver adapters** (SQLite locally via
  `better-sqlite3`; swap to Postgres/Neon for deploy)
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
- **String-typed status columns** (not native DB enums) with Zod validation, so
  the schema runs on SQLite locally and moves to Postgres with no churn.

## Getting started

Requires Node 20+.

```bash
npm install                 # installs deps and generates the Prisma client
cp .env.example .env        # local SQLite — no external DB needed
npm run db:migrate          # create the SQLite database
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

## Deploying (Postgres / Neon)

SQLite is for local dev. For a hosted deploy (e.g. Vercel + Neon):

1. Create a Postgres database (Neon has a free tier) and set `DATABASE_URL`.
2. In `prisma/schema.prisma`, set the datasource `provider` to `postgresql`.
3. In `src/lib/db.ts`, swap `PrismaBetterSqlite3` for `@prisma/adapter-pg`
   (`PrismaPg`). The queries don't change.
4. `npm run db:migrate` against the new database, then deploy.

## License

MIT — see [LICENSE](./LICENSE).
