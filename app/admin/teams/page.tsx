import { addManualTeam, deactivateTeam } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { getCurrentClassSession } from "@/lib/game";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ searchParams }: { searchParams: { classSessionId?: string } }) {
  await requireAdmin();
  const sessions = await prisma.classSession.findMany({ orderBy: { updatedAt: "desc" } });
  const current = searchParams.classSessionId
    ? await prisma.classSession.findUniqueOrThrow({ where: { id: searchParams.classSessionId } })
    : await getCurrentClassSession();
  const teams = await prisma.team.findMany({ where: { classSessionId: current.id }, orderBy: { teamNumber: "asc" } });
  const nextTeamNumber = (teams.at(-1)?.teamNumber ?? 0) + 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Teams</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="/admin/class-sessions">Generate teams</a>
          <a className="btn-secondary" href={`/api/admin/export/teams?classSessionId=${current.id}`}>Export handout CSV</a>
        </div>
      </div>
      <form className="panel flex flex-wrap items-end gap-3 p-4">
        <label><span className="label">Class session</span><select className="input mt-1" name="classSessionId" defaultValue={current.id}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
        <button className="btn-secondary">View</button>
      </form>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Live students submit from their participant session after assignment; team codes are no longer required for the main classroom flow.</p>
      <form action={addManualTeam} className="panel grid gap-4 p-5 md:grid-cols-5">
        <h2 className="text-2xl font-black md:col-span-5">Add or edit team</h2>
        <input type="hidden" name="classSessionId" value={current.id} />
        <label><span className="label">Team number</span><input className="input mt-1" name="teamNumber" defaultValue={nextTeamNumber} /></label>
        <label><span className="label">Name</span><input className="input mt-1" name="name" defaultValue={`Team ${nextTeamNumber}`} /></label>
        <label><span className="label">Planned size</span><input className="input mt-1" name="plannedSize" placeholder={`${current.minTeamSize}-${current.maxTeamSize}`} /></label>
        <label><span className="label">Captain email</span><input className="input mt-1" name="captainEmail" /></label>
        <button className="btn-primary">Save team</button>
      </form>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Team</th><th className="p-3">Name</th><th className="p-3">Planned size</th><th className="p-3">Active</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{teams.map((team) => <tr key={team.id} className="border-t"><td className="p-3">{team.teamNumber}</td><td className="p-3 font-bold">{team.name}</td><td className="p-3">{team.plannedSize ?? "-"}</td><td className="p-3">{team.active ? "Yes" : "No"}</td><td className="flex gap-2 p-3"><form action={deactivateTeam}><input type="hidden" name="teamId" value={team.id} /><button className="btn-secondary">Deactivate</button></form></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
