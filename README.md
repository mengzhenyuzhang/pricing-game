# Customer Valuations Game Web App

Production-quality MVP for a live MBA revenue-management pricing game inspired by Kalyan Talluri's customer valuations game. The app supports arbitrary class sizes, collects willingness-to-pay and attendance mode live at check-in, assigns hybrid-aware teams, and keeps team decisions private until the instructor reveals results.

This is suitable for classroom use on a trusted network. It is not designed for high-stakes financial systems, public payments, or adversarial security environments.

## Stack

- Next.js App Router with TypeScript
- Prisma ORM
- SQLite for local development
- PostgreSQL-compatible model design for production migration
- Tailwind CSS
- Zod validation
- Recharts
- Vitest

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open `http://localhost:3000`.

Required environment variables:

```text
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="change-me"
SESSION_SECRET="change-me-to-a-long-random-string"
```

For production PostgreSQL, change the Prisma datasource provider to `postgresql`, set `DATABASE_URL` to your hosted PostgreSQL URL, and run Prisma migrations against that database. The models avoid SQLite-specific field types.

## Commands

```bash
npm run dev
npm run build
npm run test
npm run seed
npx prisma migrate dev
```

The seed script is configurable:

```bash
DEMO_STUDENTS=40 npm run seed
DEMO_STUDENTS=66 MIN_TEAM_SIZE=4 MAX_TEAM_SIZE=5 npm run seed
```

## Live Classroom Workflow

1. Instructor logs in at `/admin/login`.
2. Instructor creates a class session and opens check-in.
3. Students scan or open the join URL, usually `/join/[classSessionCode]`.
4. Students enter name, optional email, required attendance mode, and willingness-to-pay valuation.
5. Students wait in `/lobby`; no refresh is required.
6. Instructor watches checked-in students accumulate, including in-person and online counts, in `/admin/class-sessions/[id]`.
7. Instructor closes check-in and chooses minimum and maximum team size, default 4-5.
8. Instructor chooses an attendance grouping strategy.
9. Instructor previews teams at `/admin/class-sessions/[id]/teams`.
10. Instructor manually adjusts if needed, or changes the settings and previews again.
11. Instructor publishes teams.
12. Student browsers automatically move from `/lobby` to `/team`.
13. Instructor creates and opens pricing rounds.
14. Any assigned team member can submit the team decision from `/team`; the latest valid submission before lock/deadline counts.
15. Instructor locks, simulates, and reveals results.
16. Instructor can reveal the final valuation histogram and export results.

No pre-class valuation collection is required. `/valuation` redirects to `/join`; legacy/imported valuations are optional admin data only.

## Student Pages

- `/` redirects to the active open check-in session, or shows that no session is open.
- `/join` and `/join/[classSessionCode]` live student check-in.
- `/lobby` waiting room with student name, attendance mode, and automatic polling every few seconds.
- `/team` assigned team view, teammate names, teammate attendance modes, team type, current round, team decision form, and the team's own latest decision.
- `/scoreboard` public scoreboard with auto-refresh.

## Instructor Pages

- `/admin/login` password login using `ADMIN_PASSWORD`.
- `/admin` dashboard, active sessions, check-in controls, and run controls.
- `/admin/class-sessions` create and browse class sessions.
- `/admin/class-sessions/[id]` join URL, checked-in count, in-person/online counts, participant list, admin-visible valuations, and duplicate/test participant removal.
- `/admin/class-sessions/[id]/teams` preview and publish attendance-aware random assignments.
- `/admin/class-sessions/[id]/runs` create static, dynamic, and postscreening runs for that session.
- `/admin/run/[id]` detailed run and period controls, missing teams, submissions, decisions, and results.
- `/admin/valuations` optional legacy/import support and admin-only histogram tools.

## Privacy Defaults

- Students never see the full valuation list.
- Students never see other teams' hidden submissions before reveal.
- Student/team routes identify students with an HTTP-only participant session cookie.
- Public scoreboard rows omit event-level valuation amounts.
- Prices are hidden on the public scoreboard until `revealPrices` is enabled.
- Each team is simulated against the same customer stream in parallel.

## Team Assignment

Class sessions support any student count. Recommended team size is 4-5, but the instructor can configure the range.

The instructor can choose one of three attendance grouping strategies:

- Prefer same attendance, default: keeps in-person students with in-person students and online students with online students whenever feasible. Mixed teams are created only when required by the numbers and selected team-size constraints.
- Strict separate attendance: creates only in-person-only and online-only teams. If either attendance group cannot independently form valid teams, publishing is blocked until settings change or the instructor overrides manually.
- Ignore attendance: randomly assigns all checked-in students regardless of attendance mode.

The team generator:

- Uses only checked-in participants in the active class session.
- Prefers the fewest number of teams that respects the maximum team size.
- Keeps sizes balanced using `floor(N / T)` plus remainder distribution.
- Minimizes mixed teams under Prefer Same Attendance.
- Keeps minority attendance groups together in mixed teams when mixing is required, instead of scattering students one-by-one where avoidable.
- Refuses impossible small classes unless the instructor explicitly overrides.
- Randomly shuffles both participants and team-size order before assignment.

For an MBA class of 66 students with 4-5 person teams, the default generator creates 14 balanced teams: ten teams of 5 and four teams of 4.

Late students are not silently inserted into existing games. If check-in is closed or teams have been assigned, the instructor should reopen check-in or manually manage the participant/team assignment.

## Runs And Defaults

- Runs belong to a `ClassSession`.
- Simulations use `Participant.valuationAmount` from checked-in participants.
- `CustomerDraw` snapshots valuation amounts so later edits do not change an already-generated run.
- Draw count defaults to `round(checked-in participant count * target draw percent)`, clamped between 1 and the checked-in participant count.
- Static capacity defaults to the checked-in participant count or higher, so it does not bind by default.
- Dynamic pricing defaults to 5 periods, configurable per run.
- Postscreening capacity defaults to approximately 35% of checked-in participant count, configurable per run.
- Postscreening defaults to cutoff 3500 for LOW/HIGH segment assignment.
- Opening a period sets a 90-second deadline.
- If a dynamic team misses a later period, the simulator carries forward its previous submitted price. If no previous price exists, simulation stops until the instructor gets or enters a decision.

## CSV Exports

Admin export endpoints:

- `/api/admin/export/participants`
- `/api/admin/export/teams`
- `/api/admin/export/valuations`
- `/api/admin/export/submissions?runId=...`
- `/api/admin/export/decisions?runId=...`
- `/api/admin/export/results?runId=...`
- `/api/admin/export/events?runId=...`
