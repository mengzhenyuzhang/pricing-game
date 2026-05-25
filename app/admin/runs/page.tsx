import Link from "next/link";
import { createCustomRun, createPresetRun } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { getCurrentClassSession } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { defaultCapacity, defaultDrawCount } from "@/lib/team-generation";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function RunsPage({ searchParams }: { searchParams: { classSessionId?: string } }) {
  await requireAdmin();
  const sessions = await prisma.classSession.findMany({ orderBy: { updatedAt: "desc" } });
  const current = searchParams.classSessionId
    ? await prisma.classSession.findUniqueOrThrow({ where: { id: searchParams.classSessionId } })
    : await getCurrentClassSession();
  const valuationCount = await prisma.participant.count({ where: { classSessionId: current.id } });
  const runs = await prisma.gameRun.findMany({ where: { classSessionId: current.id }, orderBy: { createdAt: "desc" } });
  const staticCapacity = defaultCapacity("STATIC", valuationCount);
  const postCapacity = defaultCapacity("POSTSCREENING", valuationCount);
  const drawCount = defaultDrawCount(valuationCount, current.targetDrawPercent);
  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-black">Game Runs</h1>
      <form className="panel flex flex-wrap items-end gap-3 p-4">
        <label><span className="label">Class session</span><select className="input mt-1" name="classSessionId" defaultValue={current.id}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
        <button className="btn-secondary">View</button>
        <span className="text-sm text-slate-600">{valuationCount} checked-in participants, default draw {drawCount}</span>
      </form>
      <section className="panel p-5">
        <h2 className="text-2xl font-black">Presets</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[["static1", "Static Round 1"], ["static2", "Static Round 2"], ["dynamic", "Dynamic Pricing Game"], ["post", "Postscreening Game"]].map(([preset, label]) => (
            <form key={preset} action={createPresetRun}><input type="hidden" name="classSessionId" value={current.id} /><input type="hidden" name="preset" value={preset} />{preset === "dynamic" ? <input type="hidden" name="dynamicPeriods" value="10" /> : null}<button className="btn-primary">{label}</button></form>
          ))}
        </div>
      </section>
      <form action={createCustomRun} className="panel grid gap-4 p-5 md:grid-cols-3">
        <h2 className="text-2xl font-black md:col-span-3">Custom run</h2>
        <input type="hidden" name="classSessionId" value={current.id} />
        <label><span className="label">Name</span><input className="input mt-1" name="name" required /></label>
        <label><span className="label">Type</span><select className="input mt-1" name="type"><option>STATIC</option><option>DYNAMIC</option><option>POSTSCREENING</option></select></label>
        <label><span className="label">Capacity</span><input className="input mt-1" name="capacity" defaultValue={staticCapacity} /></label>
        <label><span className="label">Draw count optional</span><input className="input mt-1" name="drawCount" placeholder={String(drawCount)} /></label>
        <label><span className="label">Draw percent</span><input className="input mt-1" name="drawPercent" defaultValue={current.targetDrawPercent} /></label>
        <label><span className="label">Dynamic days</span><input className="input mt-1" name="dynamicPeriods" defaultValue="10" min="10" /></label>
        <label><span className="label">Postscreening capacity guide</span><input className="input mt-1" value={postCapacity} readOnly /></label>
        <label><span className="label">Segment cutoff</span><input className="input mt-1" name="segmentCutoff" placeholder="3500" /></label>
        <button className="btn-primary md:col-span-3">Create custom run</button>
      </form>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Run</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Capacity</th><th className="p-3">Draws</th><th className="p-3">Periods</th><th className="p-3"></th></tr></thead>
          <tbody>{runs.map((run) => <tr key={run.id} className="border-t"><td className="p-3 font-bold">{run.name}</td><td className="p-3">{run.type}</td><td className="p-3"><StatusBadge status={run.status} /></td><td className="p-3">{run.capacity}</td><td className="p-3">{run.drawCount ?? "auto"}</td><td className="p-3">{run.dynamicPeriods}</td><td className="p-3"><Link className="btn-secondary" href={`/admin/run/${run.id}`}>Control</Link></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
