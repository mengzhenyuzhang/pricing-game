import { redirect } from "next/navigation";
import { getPlayableRun } from "@/lib/game";
import { requireParticipant } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";
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
  return (
    <div className="mx-auto max-w-4xl space-y-5">
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
                {playable.run.type === "POSTSCREENING"
                  ? `Low $${activeDecision.lowPriceUsed ?? "-"}, high $${activeDecision.highPriceUsed ?? "-"}, limit ${activeDecision.bookingLimitUsed ?? "-"}`
                  : `Price $${activeDecision.priceUsed ?? "-"}`}
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="panel p-8 text-center text-xl font-bold">Waiting for instructor to open the next round.</section>
      )}
    </div>
  );
}

function teamTypeLabel(attendanceMix?: string | null) {
  if (attendanceMix === "ONLINE_ONLY") return "Online team";
  if (attendanceMix === "MIXED") return "Mixed team";
  return "In-person team";
}
