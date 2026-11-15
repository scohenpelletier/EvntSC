# EvntSC

EvntSC is an event planner for USC student club leaders. Describe an event in plain language (for example, “a networking night for 60 USC students and 5 alumni next month, $800 budget, want food, haven't booked a room”) and get an actionable plan: what to do and in what order, whom to contact, what to ask, and how to stay within budget. Change the event conversationally (“attendance increased to 100”) and EvntSC updates the affected parts of the plan, explains what changed, and keeps completed work, notes, and manually entered costs.

Flow: describe → answer up to three quick questions → plan (Overview, Checklist, Contacts, Budget, Drafts) → update the event → save → export a planning packet.

> Independent student-built prototype. Not affiliated with or endorsed by USC. It does not verify officer identity, approve events, book rooms, submit funding applications, or guarantee funding.

## What's in the box

| Area | Where |
| --- | --- |
| Next.js 16 App Router UI (React 19, Tailwind 4) | `src/app`, `src/components` |
| Integer-cent budget math and findings | `src/lib/money.ts`, `src/lib/budget.ts` |
| America/Los_Angeles dates, with DST gap and overlap handling | `src/lib/dates.ts` (Luxon) |
| Vetted policy-source registry (verbatim passages, review dates) | `src/lib/policy/registry.ts` |
| Deterministic rule engine (tri-state: yes / no / unknown) | `src/lib/policy/engine.ts` |
| Task reconciliation (stable IDs, Needs recheck, notes kept) | `src/lib/tasks/reconcile.ts` |
| Contacts and services dataset (verified details, review dates) | `src/lib/resources.ts` |
| Outreach templates, placeholders, email scrubbing | `src/lib/outreach.ts` |
| Conversational event updates and change explanations | `src/lib/changes.ts`, `src/components/UpdateEvent.tsx` |
| Demo-mode fixture (used only without an AI key) | `src/lib/demo-fixtures.ts` |
| Planning packet (print view and standalone HTML) | `src/lib/packet.ts`, `/api/plans/[id]/export` |
| AI adapters: Gemini or Claude (bounded, validated, timeout) | `src/lib/ai/` (`index.ts`, `core.ts`, `gemini.ts`, `anthropic.ts`, `sanitize.ts`) |
| Supabase Auth, owner-scoped storage, RLS | `src/lib/supabase/*`, `src/lib/plans-repo.ts`, `supabase/migrations/0001_event_plans.sql` |
| TroyLens (optional): public event cards and Discover | `src/lib/troylens/`, `src/components/PublishCard.tsx`, `/discover`, `/events/[id]`, `supabase/migrations/0002_event_listings.sql` |
| Fictional sample plans | `src/lib/samples.ts` |
| Tests | `tests/*.test.ts`, `scripts/check-authz.ts` |

## Install and run

Requires Node 20+ (developed on Node 24) and npm.

```bash
npm install
cp .env.example .env.local     # then fill in values, see below
npm run dev                    # http://localhost:3000
```

The app runs without any configuration. Without Supabase, `/setup` explains the missing setup and `/demo` offers a **local demo** that keeps plans in this browser only. The demo is not an account and does not sync between devices. Without an AI key (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`), AI controls are replaced by manual mode: the form, the built-in update parser, and template drafts. A **demo mode** button loads a pre-written reading of the example prompt, labeled “Demo fixture — not live AI”. It never reads the organizer's own text. The `/demo` pages always run in this mode.

### Supabase setup (accounts and saved plans)

1. Create a project at supabase.com.
2. In **SQL Editor**, run `supabase/migrations/0001_event_plans.sql`. It creates `event_plans`, the per-operation owner RLS policies, and a trigger that blocks owner reassignment and bumps `version`.
3. In **Authentication → URL Configuration**:
   - Set Site URL to `http://localhost:3000`.
   - Add `http://localhost:3000/auth/callback` under Redirect URLs.
4. In **Authentication → Providers → Email**:
   - Keep Email enabled.
   - Keep **Confirm email** on. Sign-up then sends a verification link, and "Forgot password" sends a recovery link. Both land on `/auth/callback`.
   - Sign-up only accepts emails ending in `usc.edu` (checked in the form). To enforce it server-side too, add a Supabase "Before User Created" auth hook that rejects other domains.
   - The built-in Supabase mailer is rate-limited. Configure custom SMTP for anything beyond testing.
5. Copy these values from **Project Settings → API** into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY`, which only `npm run check:authz` and `npm run check:flow` use (to create and delete throwaway test users)
6. Restart `npm run dev`. `NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing them.

### TroyLens (optional extension)

Public event cards and a Discover page. EvntSC does not depend on them.

1. In **SQL Editor**, run `supabase/migrations/0002_event_listings.sql` after `0001`.
2. Set `NEXT_PUBLIC_ENABLE_TROYLENS=true` in `.env.local` and restart. Leave it unset or `false` and every TroyLens control, page and API route disappears (404). Planning, saving and export are unchanged.

How it works:

- **Publishing is explicit.** The plan page gets a *Public event card* section with a live preview. Publish, update and retract each ask for confirmation.
- **Only card fields are shared:** title, organizer, confirmed date/time, location (or *to be announced*), a public description the organizer writes, and up to 5 topic tags. Budgets, tasks, notes, questions and account data stay in `event_plans`.
- The server builds the title, organizer, date, time and location from the **saved** plan, never from the request. An unconfirmed date or venue is published as *to be announced*. If a shared field changes after publishing, the plan page says the card is out of date.
- `event_listings` reuses the plan ID and has **no owner column**. RLS lets anyone read cards, but only the owner of the matching plan can insert, update or delete one. Deleting a plan deletes its card.
- **Discover** (`/discover`, no sign-in needed to browse) ranks upcoming events by how many of the viewer's interests they share, then by date. Signed-in users choose interests under **Settings** (account menu); they are saved on the account (Supabase user metadata, no extra table). The match label ("Matches your Tech interest") lists only interests the viewer chose. Nothing is tracked or learned; signed-out visitors see events by date.

### AI integration

EvntSC has two interchangeable server-side adapters. `AI_PROVIDER` picks one (`gemini` or `anthropic`). If it is unset, whichever key is present is used, Gemini first. Keys are server-only.

- **Google Gemini (default; has a free tier):** create a key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY`. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. On the free tier Google may use inputs to improve its products, so use fictional data in demos.
- **Anthropic Claude:** set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-opus-5-5`.

AI is used for four things: reading the description into fields, reading a conversational change into a field patch, writing an outreach draft, and explaining checklist items. Code does all arithmetic, dates, dependency checks, task merging, and change explanations.

`/setup` shows which provider and model are active. Both adapters share the same prompts, Zod output schemas, limits, and post-processing (`src/lib/ai/core.ts`, `sanitize.ts`), so the rules under "How it stays honest" apply to either one.

## Commands

```bash
npm run typecheck     # next typegen && tsc --noEmit
npm run lint          # eslint
npm test              # vitest: money, budget, DST, rules, reconciliation, AI sanitizing, packet, planner (tests/planner.test.ts)
npm run build         # production build
npm run check:authz   # two-account RLS check against your Supabase project (needs service-role key)
APP_URL=http://localhost:3000 npm run check:authz   # also exercises the app's API routes (dev server running)
npm run check:flow    # signed-in create → save → stale-save 409 → sign out/in → export → samples (dev server running)
npm run check:ai      # live smoke test of the configured AI provider (2 real model calls, fictional data)
npm run check:ai-planner  # live check of description, change, and draft AI paths with assertions (~10 real calls, fictional data)
```

## How it stays honest

- **Plan structure:** each task has a planning area (venue, guests, catering, budget, promotion, accessibility, event-day, follow-up), a status (to do, in progress, done), a suggested date or lead time, dependencies, related contacts, and one designation:
  - *Verified requirement*: a registered rule whose source applies to this event.
  - *Recommendation*: EvntSC planning advice; its dates are labeled "not a USC deadline".
  - *Needs confirmation*: may apply or is undocumented (for example, the TES space rule when recognition status is unknown).
  - When the usual lead time has passed, the task says so and gives a practical next step. A USG request for an event under 42 days away is flagged as very likely too late, because six academic weeks is at least 42 calendar days.
- **Contacts:** `src/lib/resources.ts` is hand-reviewed data, separate from generated text. Each detail was copied from the official page on 2026-11-14 (USG funding, 2026-11-12). Missing or conflicting details are `null` and render as *Needs verification*. For example, the University Club has no verifiable contact, and the Campus Activities page shows two different email addresses. Prices appear only where the page states them (Catering2Go delivery minimums). Availability, approval, and booking status are never stored.
- **Drafts:** templates fill only from the organizer's details. Anything missing becomes a `[BRACKETED PLACEHOLDER]`, and the draft lists what to fill in before sending. AI drafts are saved as a new version (the organizer's edits are never overwritten), and any email address not in the dataset is replaced with `[EMAIL — needs verification]`. Nothing is sent and nothing is booked.
- **Event updates:** a built-in parser handles common phrasings (attendance, budget, outdoors, outside guests, food, accessibility). With AI configured, the model fills in the rest: numbers must appear in the message, and it can't mark a venue confirmed. The preview runs the real recompute, so the organizer sees which fields change, which tasks are added, which existing tasks need review and why, and the budget effect, before applying. Each applied update is stored in the plan's change log.

- **Budget:** quantity × unit cost in integer cents, rounded half-up once per line.
  - A line can be marked "cost unknown". The budget then shows a known subtotal and a warning, never a final total.
  - The organizer's target, funding requested, and confirmed funding are separate fields. Requested funding is never counted as available.
  - Each known cost is an *estimate* or a *written quote*, and the totals show both. Unknown costs are counted and listed, never treated as $0.
  - When known costs exceed the target, savings ideas show their saving (computed in code) and the assumption behind it.
  - A food line smaller than the expected headcount is flagged. The line itself is never changed.
- **Sources:** each rule has a stable ID, title, official URL, review date, verbatim passage, effective date (when known), and an applicability condition. The checklist shows only a link to the official page; passages and review dates stay in the registry and the exported packet.
  - The USG Funding Guidelines document required sign-in and could not be read. It appears only as a "read it yourself" question.
  - No verified rule was found for vendors or outside speakers in general, so those stay open questions.
- **Unknown stays unknown:** an unknown condition produces a *Missing information* or *Needs confirmation* item and never counts as passed.
- **Deadlines:**
  - Academic-week rules ("six academic weeks", "starting Week 4") are never converted to calendar dates. They show the cited wording and *Needs confirmation*.
  - The only computed official date is the UEPA fundraising meeting. Its source says "at least two weeks prior" in plain weeks, so the date is event date − 14 days, labeled as calculated from the cited rule.
  - Suggested reminders use documented EvntSC offsets (`SUGGESTION_OFFSETS`) and are labeled "not a USC deadline".
  - Organizer target dates are labeled as such.
- **Revision:**
  - Derived tasks are recomputed from the intake on every edit. Only the organizer's state (status, notes, target, completion snapshot) is stored, keyed by stable task ID.
  - When a completed task's inputs change, the task shows *Needs recheck* with the exact change, for example "Event date changed from 2027-03-10 to 2027-03-17".
  - Tasks that stop applying move to "Not applicable now" with their notes kept.
- **AI:** the model only proposes values.
  - Intake proposals drop prices, attendance, and targets that do not appear literally in the organizer's text. Dates without a year, or with relative wording, are flagged *Needs confirmation*.
  - Review output is limited to registered rule IDs that currently apply. Passages and links always come from the registry.
  - Model text is rendered as plain text and labeled "AI suggestion".
  - Inputs are capped at 4,000 characters. Outputs are constrained by a JSON schema and then re-validated with Zod on the server. Calls time out after 30 s and are rate-limited per user.
  - Gemini: safety blocks and truncated output are reported as errors, never applied. Claude: one automatic retry, plus Anthropic's server-side refusal fallback (`fallbacks: "default"`).
- **Security:**
  - Ownership comes from the verified Supabase session (`auth.getUser()`), and RLS enforces it.
  - Another user's plan returns 404 for read, update, delete, and export.
  - Mutating routes reject cross-origin requests.
  - Account pages and APIs are `Cache-Control: private, no-store`.
  - Sign-out clears account-scoped browser state and hard-reloads.

## Known limitations

- **Storage:** assumptions, drafts, and the change log are stored inside the existing `intake` jsonb column (under `_workspace`), so no database migration is needed. Plans saved before this change load with these lists empty.
- **Coverage:** the contacts dataset is deliberately small: TES, Campus Activities, USC Hospitality (Catering2Go and catering approvals), the University Club, USG Funding, and OSAS. No outside vendors are listed.
- **Built-in parser:** without AI, it doesn't understand date changes. Use Edit details for those.
- The registry was reviewed on 2026-11-12 from pages fetched by an automated reader. Re-review it before relying on it, because pages change.
  - The USG Funding Guidelines doc, the RSO Privileges & Responsibilities page (HTTP 504), the Student Handbook PDF, and the TES Terms PDF were not read.
- The USG deadline wording ("and or nine academic weeks…") is ambiguous. EvntSC shows it verbatim and does not interpret it.
- The AI rate limiter is in-memory per server instance.
- When accounts are not configured, the local-development AI routes accept unauthenticated requests. Don't expose such a server publicly with an API key set.
- Overnight events and multi-day events are not supported. TroyLens covers publishing and Discover only: no flyer/OCR ingestion, personal calendars, duplicate detection or onboarding.
- TroyLens does not verify organizers or moderate cards. Anyone with an account can publish a card for their own plan.

### Fonts

Headings use Caslon, USC's display face. Adobe Caslon Pro is licensed, so the app ships the free Libre Caslon Text revival by default. To use the real Adobe Caslon Pro, create a web project at fonts.adobe.com that includes it, allow your domains (and `localhost`), and put the project ID in `NEXT_PUBLIC_ADOBE_FONTS_KIT`.
