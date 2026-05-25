import { redirect } from "next/navigation";
import { getPlayableRun } from "@/lib/game";
import { requireParticipant } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
import type { SimulationEvent } from "@/lib/types";
import { TeamAutoRefresh } from "./team-auto-refresh";
import { TeamDecisionForm } from "./team-decision-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const participant = await requireParticipant();
  if (!participant.teamId || !participant.team) redirect("/lobby");
  const playable = await getPlayableRun(participant.classSessionId);
  const activeDecision = playable
    ? await prisma.activeDecision.findFirst({
        where: { gameRunId: playable.run.id, periodId: playable.period?.id ?? null, teamId: participant.teamId },
        include: { submitterParticipant: true }
      })
    : null;
  const resultsRun = playable?.run ?? await prisma.gameRun.findFirst({
    where: { classSessionId: participant.classSessionId, status: { in: ["SIMULATED", "REVEALED"] } },
    orderBy: { updatedAt: "desc" }
  });
  const teamResult = resultsRun
    ? await prisma.teamResult.findFirst({ where: { gameRunId: resultsRun.id, teamId: participant.teamId } })
    : null;
  const dailyRows = resultsRun ? buildDailyRows(resultsRun.currentDrawOrder, teamResult?.eventsJson ?? "[]") : [];
  const remainingCapacity = resultsRun ? Math.max(0, resultsRun.capacity - (teamResult?.capacityUsed ?? 0)) : null;
  const pageSignature = teamPageSignature(
    playable?.run.id ?? null,
    playable?.period?.id ?? null,
    playable?.run.status ?? null,
    playable?.period?.status ?? null,
    resultsRun?.id ?? null,
    resultsRun?.currentDrawOrder ?? 0
  );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <TeamAutoRefresh initialSignature={pageSignature} />
      <section className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-coral">{participant.classSession.name}</p>
        <h1 className="mt-2 text-4xl font-black">{participant.team.name}</h1>
        <p className="mt-2 inline-flex rounded-full bg-mint px-3 py-1 text-sm font-bold">{teamTypeLabel(participant.team.attendanceMix)}</p>
        <p className="mt-3 text-sm text-slate-600">Signed in as <span className="font-bold">{participant.displayName}</span>. Testing multiple students on one laptop requires separate browser profiles/incognito windows, or use <a className="font-bold text-coral underline" href="/api/logout">switch student</a>.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {participant.team.participants.map((member) => (
            <div className="rounded-md bg-slate-50 px-3 py-2" key={member.id}>
              <p className="font-semibold">{member.displayName}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{member.attendanceMode === "ONLINE" ? "Online" : "In person"}</p>
            </div>
          ))}
        </div>
      </section>
      {playable && playable.run.classSessionId === participant.classSessionId ? (
        <section className="panel p-6">
          <h2 className="text-2xl font-black">{playable.run.name}</h2>
          <p className="mt-1 text-slate-600">{playable.period?.label ?? playable.run.type}</p>
          <TeamDecisionForm runType={playable.run.type} />
          {activeDecision ? (
            <div className="mt-5 rounded-md bg-mint p-4">
              <h3 className="font-bold">Your team&apos;s latest submission</h3>
              <p className="mt-1 text-sm text-slate-700">Submitted by {activeDecision.submitterParticipant?.displayName ?? "a teammate"} at {activeDecision.submittedAt.toLocaleTimeString()}.</p>
              <p className="mt-2 font-semibold">
                Price ${activeDecision.priceUsed ?? "-"}
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="panel p-8 text-center text-xl font-bold">Waiting for instructor to open the next round.</section>
      )}
      {resultsRun && resultsRun.currentDrawOrder > 0 ? (
        <section className="panel p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Your Team&apos;s Daily Results</h2>
              <p className="mt-1 text-slate-600">{resultsRun.name} through day {resultsRun.currentDrawOrder}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <p className="rounded-md bg-mint px-4 py-2 text-xl font-black">${dailyRows.at(-1)?.cumulativeRevenue.toLocaleString() ?? "0"}</p>
              <p className="rounded-md bg-slate-100 px-4 py-2 text-xl font-black">{remainingCapacity} capacity left</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600">
                <tr>
                  <th className="p-3">Day</th>
                  <th className="p-3">Arrival</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3 text-right">Earned</th>
                  <th className="p-3 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr className="border-t" key={row.day}>
                    <td className="p-3 font-bold">{row.day}</td>
                    <td className="p-3">{row.hasArrival ? "Customer arrived" : "No arrival"}</td>
                    <td className="p-3 text-right">{row.hasArrival ? formatMoney(row.priceApplied) : "-"}</td>
                    <td className="p-3 font-semibold">{row.hasArrival ? (row.accepted ? "Purchased" : "Did not purchase") : "-"}</td>
                    <td className="p-3 text-right font-bold">${row.revenueAdded.toLocaleString()}</td>
                    <td className="p-3 text-right font-black">${row.cumulativeRevenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function teamTypeLabel(attendanceMix?: string | null) {
  if (attendanceMix === "ONLINE_ONLY") return "Online team";
  if (attendanceMix === "MIXED") return "Mixed team";
  return "In-person team";
}

function formatMoney(value?: number | null) {
  return typeof value === "number" ? `$${value.toLocaleString()}` : "-";
}

function buildDailyRows(currentDay: number, eventsJson: string) {
  const events = JSON.parse(eventsJson) as SimulationEvent[];
  const eventByDay = new Map(events.map((event) => [event.drawOrder, event]));
  let cumulativeRevenue = 0;
  return Array.from({ length: currentDay }, (_, index) => {
    const day = index + 1;
    const event = eventByDay.get(day);
    const revenueAdded = event?.revenueAdded ?? 0;
    cumulativeRevenue += revenueAdded;
    return {
      day,
      hasArrival: Boolean(event),
      customerId: event?.customerId ?? null,
      priceApplied: event?.priceApplied ?? null,
      accepted: event?.accepted ?? false,
      revenueAdded,
      cumulativeRevenue
    };
  });
}

function teamPageSignature(runId: string | null, periodId: string | null, runStatus: string | null, periodStatus: string | null, resultsRunId: string | null, currentDrawOrder: number) {
  return [runId ?? "no-open-run", periodId ?? "run-level", runStatus ?? "none", periodStatus ?? "none", resultsRunId ?? "no-results", currentDrawOrder].join(":");
}
