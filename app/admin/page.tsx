import Link from "next/link";
import { controlRun, createClassSession, createPresetRun, openCheckIn, closeCheckIn } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const [latestRun, teams, participants, sessions] = await Promise.all([
    prisma.gameRun.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.team.count({ where: { active: true } }),
    prisma.participant.count(),
    prisma.classSession.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { _count: { select: { participants: true, teams: true } } } })
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Instructor Dashboard</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/admin/teams">Teams</Link>
          <Link className="btn-secondary" href="/admin/class-sessions">Class Sessions</Link>
          <Link className="btn-secondary" href="/admin/valuations">Valuations</Link>
          <Link className="btn-secondary" href="/admin/runs">Runs</Link>
        </div>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><p className="text-sm font-bold text-slate-500">Teams</p><p className="text-4xl font-black">{teams}</p></div>
        <div className="panel p-5"><p className="text-sm font-bold text-slate-500">Checked in</p><p className="text-4xl font-black">{participants}</p></div>
        <div className="panel p-5"><p className="text-sm font-bold text-slate-500">Latest Run</p><p className="text-xl font-black">{latestRun?.name ?? "None"}</p>{latestRun ? <StatusBadge status={latestRun.status} /> : null}</div>
      </section>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Class Sessions</h2>
        <form action={createClassSession} className="mt-4 flex flex-wrap items-end gap-3">
          <label><span className="label">New session name</span><input className="input mt-1" name="name" placeholder="Today&apos;s class" /></label>
          <label><span className="label">Join code optional</span><input className="input mt-1" name="code" /></label>
          <input type="hidden" name="targetDrawPercent" value="0.70" />
          <input type="hidden" name="minTeamSize" value="4" />
          <input type="hidden" name="maxTeamSize" value="5" />
          <button className="btn-primary">Create session</button>
        </form>
        <div className="mt-4 grid gap-3">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-bold">{session.name}</p><p className="text-sm text-slate-600">Join: /join/{session.code} · {session._count.participants} checked in · {session._count.teams} teams</p></div>
                <div className="flex flex-wrap gap-2">
                  <form action={openCheckIn}><input type="hidden" name="classSessionId" value={session.id} /><button className="btn-secondary">Open check-in</button></form>
                  <form action={closeCheckIn}><input type="hidden" name="classSessionId" value={session.id} /><button className="btn-secondary">Close check-in</button></form>
                  <Link className="btn-secondary" href={`/admin/class-sessions/${session.id}`}>Dashboard</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {latestRun ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-2xl font-black">{latestRun.name}</h2><StatusBadge status={latestRun.status} /></div>
            <Link className="btn-secondary" href={`/admin/run/${latestRun.id}`}>Detailed control</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["open", "lock", "simulate", "reveal", "revealPrices", "revealHistogram", "reset"].map((action) => (
              <form action={controlRun} key={action}>
                <input type="hidden" name="runId" value={latestRun.id} />
                <input type="hidden" name="action" value={action} />
                <button className="btn-secondary">{action}</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
