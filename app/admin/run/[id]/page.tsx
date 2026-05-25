import { notFound } from "next/navigation";
import { controlRun } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

function ControlButton({ runId, action, periodId, label }: { runId: string; action: string; periodId?: string; label?: string }) {
  return (
    <form action={controlRun}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="action" value={action} />
      {periodId ? <input type="hidden" name="periodId" value={periodId} /> : null}
      <button className="btn-secondary">{label ?? action}</button>
    </form>
  );
}

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const run = await prisma.gameRun.findUnique({
    where: { id: params.id },
    include: {
      periods: { orderBy: { periodNumber: "asc" } },
      draws: true,
      decisions: { include: { team: true, period: true }, orderBy: { team: { teamNumber: "asc" } } },
      results: { include: { team: true }, orderBy: { rank: "asc" } },
      submissions: { include: { team: true }, orderBy: { submittedAt: "desc" } }
    }
  });
  if (!run) notFound();
  const teams = await prisma.team.findMany({ where: { classSessionId: run.classSessionId, active: true }, orderBy: { teamNumber: "asc" } });
  const submittedTeamIds = new Set(run.decisions.map((decision) => decision.teamId));
  const missing = teams.filter((team) => !submittedTeamIds.has(team.id));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-black">{run.name}</h1><div className="mt-2 flex gap-2"><StatusBadge status={run.status} /><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{run.type}</span></div></div>
        <a className="btn-secondary" href={`/api/admin/export/results?runId=${run.id}`}>Export results CSV</a>
      </div>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Run Controls</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["open", "lock", "simulate", "reveal", "revealPrices", "revealHistogram", "reset"].map((action) => <ControlButton key={action} runId={run.id} action={action} />)}
        </div>
      </section>
      {run.periods.length ? (
        <section className="panel p-5">
          <h2 className="text-2xl font-black">Dynamic Periods</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {run.periods.map((period) => (
              <div className="rounded-md border border-slate-200 p-3" key={period.id}>
                <div className="font-bold">{period.label}</div>
                <StatusBadge status={period.status} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <ControlButton runId={run.id} periodId={period.id} action="open" label="Open" />
                  <ControlButton runId={run.id} periodId={period.id} action="lock" label="Lock" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Customer draw</p><p className="text-3xl font-black">{run.draws.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Submitted teams</p><p className="text-3xl font-black">{submittedTeamIds.size}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Missing teams</p><p className="text-3xl font-black">{missing.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Results</p><p className="text-3xl font-black">{run.results.length}</p></div>
      </section>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Missing Teams</h2>
        <p className="mt-2 text-slate-700">{missing.length ? missing.map((team) => team.name).join(", ") : "All active teams have an active decision."}</p>
      </section>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[860px]"><thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Team</th><th className="p-3">Period</th><th className="p-3">Price</th><th className="p-3">Low</th><th className="p-3">High</th><th className="p-3">Limit</th><th className="p-3">Submitted</th></tr></thead><tbody>{run.decisions.map((d) => <tr className="border-t" key={d.id}><td className="p-3 font-bold">{d.team.name}</td><td className="p-3">{d.period?.label ?? "-"}</td><td className="p-3">{d.priceUsed}</td><td className="p-3">{d.lowPriceUsed}</td><td className="p-3">{d.highPriceUsed}</td><td className="p-3">{d.bookingLimitUsed}</td><td className="p-3">{d.submittedAt.toLocaleTimeString()}</td></tr>)}</tbody></table>
      </section>
      {run.results.length ? (
        <section className="panel overflow-x-auto">
          <table className="w-full min-w-[760px]"><thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Rank</th><th className="p-3">Team</th><th className="p-3">Sales</th><th className="p-3">Revenue</th><th className="p-3">Capacity</th></tr></thead><tbody>{run.results.map((r) => <tr className="border-t" key={r.id}><td className="p-3 font-black">{r.rank}</td><td className="p-3 font-bold">{r.team.name}</td><td className="p-3">{r.sales}</td><td className="p-3">${r.revenue.toLocaleString()}</td><td className="p-3">{r.capacityUsed}</td></tr>)}</tbody></table>
        </section>
      ) : null}
    </div>
  );
}
