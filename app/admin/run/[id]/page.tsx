import { notFound } from "next/navigation";
import { controlRun } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { ensureMinimumDynamicPeriods, getRunDayLimit } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { PendingButton } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

function ControlButton({ runId, action, periodId, label, disabled = false, pendingText }: { runId: string; action: string; periodId?: string; label?: string; disabled?: boolean; pendingText?: string }) {
  return (
    <form action={controlRun}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="action" value={action} />
      {periodId ? <input type="hidden" name="periodId" value={periodId} /> : null}
      <PendingButton disabled={disabled} pendingText={pendingText}>{label ?? action}</PendingButton>
    </form>
  );
}

export default async function RunDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { message?: string } }) {
  await requireAdmin();
  await ensureMinimumDynamicPeriods(params.id);
  const run = await prisma.gameRun.findUnique({
    where: { id: params.id },
    include: {
      periods: { orderBy: { periodNumber: "asc" } },
      draws: { orderBy: { drawOrder: "asc" } },
      decisions: { include: { team: true, period: true }, orderBy: { team: { teamNumber: "asc" } } },
      results: { include: { team: true }, orderBy: { rank: "asc" } },
      submissions: { include: { team: true }, orderBy: { submittedAt: "desc" } }
    }
  });
  if (!run) notFound();
  const teams = await prisma.team.findMany({ where: { classSessionId: run.classSessionId, active: true }, orderBy: { teamNumber: "asc" } });
  const postscreeningValuations = run.type === "POSTSCREENING"
    ? await prisma.participant.findMany({ where: { classSessionId: run.classSessionId }, select: { valuationAmount: true } })
    : [];
  const cutoff = run.segmentCutoff ?? 3500;
  const lowValuationCount = postscreeningValuations.filter((participant) => participant.valuationAmount < cutoff).length;
  const highValuationCount = postscreeningValuations.filter((participant) => participant.valuationAmount >= cutoff).length;
  const submittedTeamIds = new Set(run.decisions.map((decision) => decision.teamId));
  const missing = teams.filter((team) => !submittedTeamIds.has(team.id));
  const usesDailyPricing = run.type === "DYNAMIC" || run.type === "POSTSCREENING";
  const isReadyForFirstDay = usesDailyPricing
    ? run.status === "OPEN" || run.status === "SIMULATED" || run.status === "REVEALED"
    : run.status === "SIMULATED" || run.status === "REVEALED";
  const nextDay = usesDailyPricing ? run.currentPeriod ?? run.currentDrawOrder + 1 : run.currentDrawOrder + 1;
  const dayLimit = await getRunDayLimit(run.id);
  const dynamicDone = nextDay > dayLimit;
  const currentPeriodDecisionTeamIds = new Set(
    usesDailyPricing
      ? run.decisions.filter((decision) => decision.period?.periodNumber === nextDay).map((decision) => decision.teamId)
      : run.decisions.map((decision) => decision.teamId)
  );
  const missingCurrentDay = teams.filter((team) => !currentPeriodDecisionTeamIds.has(team.id));
  const drawByDay = new Map(run.draws.map((draw) => [draw.drawOrder, draw]));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-black">{run.name}</h1><div className="mt-2 flex gap-2"><StatusBadge status={run.status} /><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{run.type}</span></div></div>
        <a className="btn-secondary" href={`/api/admin/export/results?runId=${run.id}`}>Export results CSV</a>
      </div>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Game Controls</h2>
        {searchParams.message ? <p className="mt-3 rounded-md bg-mint p-3 font-semibold text-slate-900">{searchParams.message}</p> : null}
        <p className="mt-2 text-slate-700">{statusHelp(run.status, run.currentDrawOrder, run.draws.length)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ControlButton runId={run.id} action="open" label={usesDailyPricing ? "Open day 1 pricing" : "Open submissions"} pendingText="Opening..." disabled={run.status !== "DRAFT" && run.status !== "LOCKED"} />
          {!usesDailyPricing ? <ControlButton runId={run.id} action="simulate" label="Start day-by-day simulation" pendingText="Starting..." disabled={run.status !== "OPEN" || run.decisions.length === 0 || missing.length > 0} /> : null}
          <ControlButton runId={run.id} action="endRun" label="End run and reveal" pendingText="Ending run..." disabled={run.status === "DRAFT" || run.status === "REVEALED"} />
          <ControlButton runId={run.id} action="revealPrices" label="Reveal team prices" pendingText="Revealing prices..." disabled={run.revealPrices} />
          <ControlButton runId={run.id} action="reset" label="Reset run" pendingText="Resetting..." />
        </div>
        <p className="mt-3 text-sm text-slate-600">{usesDailyPricing ? "Open day 1 pricing once. After each day, the next pricing day opens automatically." : "Open submissions once. After all teams submit, start the day-by-day simulation, then proceed through arrivals."}</p>
      </section>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Proceed to Next Day</h2>
        <p className="mt-2 text-slate-700">Day {nextDay}: choose whether an arrival occurs. If there is an arrival, the app randomly draws one checked-in valuation and recomputes the scoreboard.</p>
        {run.type === "POSTSCREENING" ? <p className="mt-2 rounded-md bg-slate-100 p-3 text-sm font-semibold">Postscreening cutoff: {formatMoney(cutoff)} ({formatPercent(run.segmentCutoffPercent ?? 0.5)} quantile). Below cutoff draws from {lowValuationCount} valuations under this amount; above cutoff draws from {highValuationCount} valuations at or above it.</p> : null}
        <p className="mt-1 text-sm text-slate-600">Day limit: {dayLimit}, based on draw percent times the current checked-in valuation count.</p>
        {usesDailyPricing ? <p className="mt-2 rounded-md bg-mint p-3 text-sm font-semibold">Current pricing day: {nextDay}. Missing day-{nextDay} prices: {missingCurrentDay.length ? missingCurrentDay.map((team) => team.name).join(", ") : "none"}.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <ControlButton runId={run.id} action="nextDayNoArrival" label={`Proceed to day ${nextDay}: no arrival`} pendingText="Proceeding..." disabled={!isReadyForFirstDay || dynamicDone || (usesDailyPricing && missingCurrentDay.length > 0) || (!usesDailyPricing && missing.length > 0)} />
          {run.type !== "POSTSCREENING" ? (
            <ControlButton runId={run.id} action="nextDayRandomArrival" label={`Proceed to day ${nextDay}: random arrival`} pendingText="Drawing arrival..." disabled={!isReadyForFirstDay || dynamicDone || (usesDailyPricing && missingCurrentDay.length > 0) || (!usesDailyPricing && missing.length > 0)} />
          ) : null}
          {run.type === "POSTSCREENING" ? (
            <>
              <ControlButton runId={run.id} action="nextDayLowArrival" label={`Proceed to day ${nextDay}: below cutoff`} pendingText="Drawing below cutoff..." disabled={!isReadyForFirstDay || dynamicDone || missingCurrentDay.length > 0} />
              <ControlButton runId={run.id} action="nextDayHighArrival" label={`Proceed to day ${nextDay}: above cutoff`} pendingText="Drawing above cutoff..." disabled={!isReadyForFirstDay || dynamicDone || missingCurrentDay.length > 0} />
            </>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-slate-600">{usesDailyPricing ? "After you proceed, the next day opens automatically so students can adjust prices again. For postscreening, choose below cutoff or above cutoff to control the arriving customer distribution." : "For static runs, teams use the same submitted price across days."}</p>
      </section>
      {run.currentDrawOrder > 0 ? (
        <section className="panel overflow-x-auto">
          <div className="p-5">
            <h2 className="text-2xl font-black">Arrival History</h2>
            <p className="mt-2 text-sm text-slate-600">Instructor-only view. Student team pages show whether the customer purchased, but not the customer valuation.</p>
          </div>
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600">
              <tr>
                <th className="p-3">Day</th>
                <th className="p-3">Arrival</th>
                <th className="p-3">Segment</th>
                <th className="p-3 text-right">Customer valuation</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: run.currentDrawOrder }, (_, index) => {
                const day = index + 1;
                const draw = drawByDay.get(day);
                return (
                  <tr className="border-t" key={day}>
                    <td className="p-3 font-bold">Day {day}</td>
                    <td className="p-3">{draw ? draw.customerLabel : "No arrival"}</td>
                    <td className="p-3">{draw?.segment ?? "-"}</td>
                    <td className="p-3 text-right font-black">{draw ? formatMoney(draw.valuationAmountSnapshot) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Current day</p><p className="text-3xl font-black">{run.currentDrawOrder}</p><p className="text-sm text-slate-500">{run.draws.length} arrival day(s) / {dayLimit} day limit</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Submitted teams</p><p className="text-3xl font-black">{submittedTeamIds.size}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Missing teams</p><p className="text-3xl font-black">{missing.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Results</p><p className="text-3xl font-black">{run.results.length}</p></div>
      </section>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Missing Teams</h2>
        <p className="mt-2 text-slate-700">{missing.length ? missing.map((team) => team.name).join(", ") : "All active teams have an active decision."}</p>
      </section>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[760px]"><thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Team</th><th className="p-3">Day</th><th className="p-3">Price</th><th className="p-3">Submitted</th></tr></thead><tbody>{run.decisions.map((d) => <tr className="border-t" key={d.id}><td className="p-3 font-bold">{d.team.name}</td><td className="p-3">{d.period?.label ?? "-"}</td><td className="p-3">{d.priceUsed}</td><td className="p-3">{d.submittedAt.toLocaleTimeString()}</td></tr>)}</tbody></table>
      </section>
      {run.results.length ? (
        <section className="panel overflow-x-auto">
          <table className="w-full min-w-[860px]"><thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Rank</th><th className="p-3">Team</th><th className="p-3">Sales</th><th className="p-3">Revenue</th><th className="p-3">Used</th><th className="p-3">Remaining</th></tr></thead><tbody>{run.results.map((r) => <tr className="border-t" key={r.id}><td className="p-3 font-black">{r.rank}</td><td className="p-3 font-bold">{r.team.name}</td><td className="p-3">{r.sales}</td><td className="p-3">${r.revenue.toLocaleString()}</td><td className="p-3">{r.capacityUsed}</td><td className="p-3 font-bold">{Math.max(0, run.capacity - r.capacityUsed)}</td></tr>)}</tbody></table>
        </section>
      ) : null}
    </div>
  );
}

function statusHelp(status: string, currentDrawOrder: number, drawCount: number) {
  if (status === "DRAFT") return "Draft: set up the run, then open submissions.";
  if (status === "OPEN") return "Open: teams can submit or revise decisions.";
  if (status === "LOCKED") return "Locked: submissions are closed. Start the day-by-day simulation when ready.";
  if (status === "SIMULATED") return `Simulation ready: current day is ${currentDrawOrder}. ${drawCount} day(s) have had arrivals.`;
  if (status === "REVEALED") return `Revealed: current day is ${currentDrawOrder}. ${drawCount} day(s) have had arrivals.`;
  return status;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
