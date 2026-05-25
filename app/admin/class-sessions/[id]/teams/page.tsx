import { publishTeamAssignment } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAttendanceAwareTeamAssignments, type AttendanceModeStrategy } from "@/lib/team-generation";

export const dynamic = "force-dynamic";

export default async function SessionTeamsPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { warning?: string; seed?: string; minTeamSize?: string; maxTeamSize?: string; attendanceModeStrategy?: AttendanceModeStrategy };
}) {
  await requireAdmin();
  const session = await prisma.classSession.findUniqueOrThrow({
    where: { id: params.id },
    include: { participants: { orderBy: { checkedInAt: "asc" } }, teams: { include: { participants: true }, orderBy: { teamNumber: "asc" } } }
  });
  const minTeamSize = Number(searchParams.minTeamSize ?? session.minTeamSize);
  const maxTeamSize = Number(searchParams.maxTeamSize ?? session.maxTeamSize);
  const strategy = searchParams.attendanceModeStrategy ?? (session.attendanceModeStrategy as AttendanceModeStrategy) ?? "PREFER_SAME_ATTENDANCE";
  const preview = generateAttendanceAwareTeamAssignments({
    participants: session.participants,
    minTeamSize,
    maxTeamSize,
    strategy,
    randomSeed: searchParams.seed || "preview"
  });
  const participantById = new Map(session.participants.map((participant) => [participant.id, participant]));
  const inPersonCount = session.participants.filter((participant) => participant.attendanceMode !== "ONLINE").length;
  const onlineCount = session.participants.filter((participant) => participant.attendanceMode === "ONLINE").length;
  const shownTeams = preview.ok ? preview.teams : session.teams.map((team) => ({ ...team, participantIds: team.participants.map((participant) => participant.id) }));

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-black">Assign Teams</h1>
      {searchParams.warning ? <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-900">{searchParams.warning}</p> : null}
      {preview.blockingWarning ? <p className="rounded-md bg-red-50 p-3 font-semibold text-red-800">{preview.blockingWarning}</p> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="panel p-4"><p className="label">Total checked in</p><p className="text-3xl font-black">{session.participants.length}</p></div>
        <div className="panel p-4"><p className="label">In-person students</p><p className="text-3xl font-black">{inPersonCount}</p></div>
        <div className="panel p-4"><p className="label">Online students</p><p className="text-3xl font-black">{onlineCount}</p></div>
      </section>
      <form method="get" className="panel grid gap-4 p-5 md:grid-cols-5">
        <label><span className="label">Min team size</span><input className="input mt-1" name="minTeamSize" defaultValue={minTeamSize} /></label>
        <label><span className="label">Max team size</span><input className="input mt-1" name="maxTeamSize" defaultValue={maxTeamSize} /></label>
        <label className="md:col-span-2">
          <span className="label">Attendance grouping strategy</span>
          <select className="input mt-1" name="attendanceModeStrategy" defaultValue={strategy}>
            <option value="PREFER_SAME_ATTENDANCE">Prefer same attendance</option>
            <option value="STRICT_SEPARATE_ATTENDANCE">Strict separate attendance</option>
            <option value="IGNORE_ATTENDANCE">Ignore attendance</option>
          </select>
        </label>
        <label><span className="label">Random seed</span><input className="input mt-1" name="seed" defaultValue={searchParams.seed ?? ""} /></label>
        <button className="btn-secondary md:col-span-5">Preview Random Teams</button>
      </form>
      <form action={publishTeamAssignment} className="panel grid gap-4 p-5 md:grid-cols-5">
        <input type="hidden" name="classSessionId" value={session.id} />
        <input type="hidden" name="minTeamSize" value={minTeamSize} />
        <input type="hidden" name="maxTeamSize" value={maxTeamSize} />
        <input type="hidden" name="attendanceModeStrategy" value={strategy} />
        <input type="hidden" name="randomSeed" value={searchParams.seed ?? ""} />
        <div className="md:col-span-3">
          <p className="font-bold">Publish current preview</p>
          <p className="text-sm text-slate-600">Publishing saves teams, sets each participant&apos;s team, and moves waiting students to `/team` automatically.</p>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" name="allowOverride" /> Override warnings</label>
        <button className="btn-primary" disabled={!preview.ok}>Publish Teams</button>
      </form>
      {preview.assignmentSummary ? (
        <section className="panel grid gap-3 p-4 md:grid-cols-4">
          <div><p className="label">In-person-only teams</p><p className="text-2xl font-black">{preview.assignmentSummary.inPersonOnlyTeams}</p></div>
          <div><p className="label">Online-only teams</p><p className="text-2xl font-black">{preview.assignmentSummary.onlineOnlyTeams}</p></div>
          <div><p className="label">Mixed teams</p><p className="text-2xl font-black">{preview.assignmentSummary.mixedTeams}</p></div>
          <div><p className="label">Students in mixed teams</p><p className="text-2xl font-black">{preview.assignmentSummary.studentsInMixedTeams}</p></div>
          {preview.assignmentSummary.warnings.map((warning) => <p key={warning} className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900 md:col-span-4">{warning}</p>)}
        </section>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shownTeams.map((team) => (
          <div className="panel p-4" key={team.teamNumber}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{team.name}</h2>
                <p className="text-sm text-slate-600">Size: {team.plannedSize}</p>
              </div>
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold">{teamLabel(team.attendanceMix)}</span>
            </div>
            <ul className="mt-3 space-y-1">
              {team.participantIds?.map((id) => participantById.get(id)).filter(Boolean).map((participant) => (
                <li key={participant!.id} className="rounded bg-slate-50 px-2 py-1">
                  <span className="font-semibold">{participant!.displayName}</span>
                  <span className="ml-2 text-xs font-bold uppercase tracking-wide text-slate-500">{participant!.attendanceMode === "ONLINE" ? "Online" : "In person"}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {!preview.ok ? <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-900">{preview.warning}</p> : null}
    </div>
  );
}

function teamLabel(mix?: string | null) {
  if (mix === "ONLINE_ONLY") return "Online only";
  if (mix === "MIXED") return "Mixed";
  return "In-person only";
}
