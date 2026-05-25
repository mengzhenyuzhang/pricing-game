import Link from "next/link";
import { createClassSession } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClassSessionsPage({ searchParams }: { searchParams: { warning?: string } }) {
  await requireAdmin();
  const sessions = await prisma.classSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { teams: true, participants: true, runs: true } }, teams: { where: { active: true }, orderBy: { teamNumber: "asc" } } }
  });

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-black">Class Sessions</h1>
      {searchParams.warning ? <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-900">{searchParams.warning}</p> : null}
      <section className="grid gap-5 lg:grid-cols-2">
        <form action={createClassSession} className="panel grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-2xl font-black sm:col-span-2">Create class session</h2>
          <label className="sm:col-span-2"><span className="label">Name</span><input className="input mt-1" name="name" placeholder="MBA Revenue Management 2026" required /></label>
          <label><span className="label">Join code optional</span><input className="input mt-1" name="code" placeholder="MBA2026" /></label>
          <label><span className="label">Expected students</span><input className="input mt-1" name="expectedStudentCount" inputMode="numeric" /></label>
          <label><span className="label">Target draw percent</span><input className="input mt-1" name="targetDrawPercent" defaultValue="0.70" /></label>
          <label><span className="label">Min team size</span><input className="input mt-1" name="minTeamSize" defaultValue="4" /></label>
          <label><span className="label">Max team size</span><input className="input mt-1" name="maxTeamSize" defaultValue="5" /></label>
          <label className="sm:col-span-2">
            <span className="label">Attendance grouping strategy</span>
            <select className="input mt-1" name="attendanceModeStrategy" defaultValue="PREFER_SAME_ATTENDANCE">
              <option value="PREFER_SAME_ATTENDANCE">Prefer same attendance</option>
              <option value="STRICT_SEPARATE_ATTENDANCE">Strict separate attendance</option>
              <option value="IGNORE_ATTENDANCE">Ignore attendance</option>
            </select>
          </label>
          <button className="btn-primary sm:col-span-2">Create session</button>
        </form>
        <div className="panel p-5">
          <h2 className="text-2xl font-black">Live flow</h2>
          <p className="mt-3 text-slate-700">Open check-in from a session dashboard, let students join, then publish random teams from checked-in participants.</p>
        </div>
      </section>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Session</th><th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3">Expected</th><th className="p-3">Team size</th><th className="p-3">Teams</th><th className="p-3">Checked in</th><th className="p-3"></th></tr></thead>
          <tbody>{sessions.map((session) => <tr key={session.id} className="border-t"><td className="p-3 font-bold">{session.name}</td><td className="p-3 font-mono">{session.code}</td><td className="p-3">{session.status}</td><td className="p-3">{session.expectedStudentCount ?? "-"}</td><td className="p-3">{session.minTeamSize}-{session.maxTeamSize}</td><td className="p-3">{session._count.teams}</td><td className="p-3">{session._count.participants}</td><td className="p-3"><Link className="btn-secondary" href={`/admin/class-sessions/${session.id}`}>Open</Link></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
