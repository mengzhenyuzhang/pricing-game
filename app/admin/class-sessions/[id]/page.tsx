import Link from "next/link";
import { closeCheckIn, deleteClassSession, openCheckIn, removeParticipant } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClassSessionDashboard({ params }: { params: { id: string } }) {
  await requireAdmin();
  const session = await prisma.classSession.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      participants: { include: { team: true }, orderBy: { checkedInAt: "asc" } },
      teams: { include: { participants: true }, orderBy: { teamNumber: "asc" } },
      runs: { orderBy: { createdAt: "desc" } }
    }
  });
  const joinPath = `/join/${session.code}`;
  const inPersonCount = session.participants.filter((participant) => participant.attendanceMode !== "ONLINE").length;
  const onlineCount = session.participants.filter((participant) => participant.attendanceMode === "ONLINE").length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-black">{session.name}</h1><p className="mt-1 font-mono text-lg">{joinPath}</p><p className="text-sm text-slate-600">Status: {session.status}</p></div>
        <div className="flex flex-wrap gap-2">
          <form action={openCheckIn}><input type="hidden" name="classSessionId" value={session.id} /><button className="btn-primary">Open check-in</button></form>
          <form action={closeCheckIn}><input type="hidden" name="classSessionId" value={session.id} /><button className="btn-secondary">Close check-in</button></form>
        </div>
      </div>
      <section className="grid gap-4 md:grid-cols-6">
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Checked in</p><p className="text-4xl font-black">{session.participants.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">In person</p><p className="text-4xl font-black">{inPersonCount}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Online</p><p className="text-4xl font-black">{onlineCount}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Teams</p><p className="text-4xl font-black">{session.teams.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Runs</p><p className="text-4xl font-black">{session.runs.length}</p></div>
        <div className="panel p-4"><p className="text-sm font-bold text-slate-500">Join code</p><p className="text-3xl font-black">{session.code}</p></div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href={`/admin/class-sessions/${session.id}/teams`}>Team assignment</Link>
        <Link className="btn-secondary" href={`/admin/class-sessions/${session.id}/runs`}>Runs</Link>
        <Link className="btn-secondary" href={`/admin/class-sessions/${session.id}/participants`}>Participants</Link>
      </div>
      <section className="panel border-red-200 p-5">
        <h2 className="text-2xl font-black text-red-700">Danger Zone</h2>
        <p className="mt-2 text-sm text-slate-700">Delete this class session and all related participants, teams, valuations, runs, submissions, decisions, draws, and results. Type DELETE to enable the action.</p>
        <form action={deleteClassSession} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="classSessionId" value={session.id} />
          <label><span className="label">Confirmation</span><input className="input mt-1" name="confirm" placeholder="DELETE" /></label>
          <button className="btn-secondary border-red-300 text-red-700">Delete class session data</button>
        </form>
      </section>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Mode</th><th className="p-3">Valuation</th><th className="p-3">Checked in</th><th className="p-3">Team</th><th className="p-3"></th></tr></thead>
          <tbody>{session.participants.map((p) => <tr className="border-t" key={p.id}><td className="p-3 font-bold">{p.displayName}</td><td className="p-3">{p.email}</td><td className="p-3">{p.attendanceMode}</td><td className="p-3">${p.valuationAmount.toLocaleString()}</td><td className="p-3">{p.checkedInAt.toLocaleTimeString()}</td><td className="p-3">{p.team?.name ?? "-"}</td><td className="p-3"><form action={removeParticipant}><input type="hidden" name="participantId" value={p.id} /><button className="btn-secondary">Remove</button></form></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
