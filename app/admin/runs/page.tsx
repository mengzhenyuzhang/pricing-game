import Link from "next/link";
import { createCustomRun, createPresetRun } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { computeSegmentCutoffForClassSession, getCurrentClassSession } from "@/lib/game";
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
  const dynamicCapacity = defaultCapacity("DYNAMIC", valuationCount);
  const postCapacity = defaultCapacity("POSTSCREENING", valuationCount);
  const drawCount = defaultDrawCount(valuationCount, current.targetDrawPercent);
  const presetCutoffPercent = 0.5;
  const presetSegmentCutoff = await computeSegmentCutoffForClassSession(current.id, presetCutoffPercent);
  const presetCards = [
    {
      preset: "static1",
      label: "Static Round 1",
      details: [`Capacity ${staticCapacity}`, `Draw percent ${formatPercent(current.targetDrawPercent)}`, `Default draw ${drawCount}`]
    },
    {
      preset: "static2",
      label: "Static Round 2",
      details: [`Capacity ${staticCapacity}`, `Draw percent ${formatPercent(current.targetDrawPercent)}`, `Default draw ${drawCount}`]
    },
    {
      preset: "dynamic",
      label: "Dynamic Pricing Game",
      details: [`Capacity ${dynamicCapacity}`, `Day limit ${drawCount}`, `Draw percent ${formatPercent(current.targetDrawPercent)}`]
    },
    {
      preset: "post",
      label: "Postscreening Game",
      details: [`Capacity ${postCapacity}`, `Day limit ${drawCount}`, `Cutoff ${formatPercent(presetCutoffPercent)} = ${formatMoney(presetSegmentCutoff)}`, `Draw percent ${formatPercent(current.targetDrawPercent)}`]
    }
  ];
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
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {presetCards.map(({ preset, label, details }) => (
            <form className="rounded-md border border-slate-200 p-4" key={preset} action={createPresetRun}>
              <input type="hidden" name="classSessionId" value={current.id} />
              <input type="hidden" name="preset" value={preset} />
              {preset === "dynamic" || preset === "post" ? <input type="hidden" name="dynamicPeriods" value={drawCount} /> : null}
              {preset === "post" ? <input type="hidden" name="segmentCutoffPercent" value="0.5" /> : null}
              <h3 className="text-lg font-black">{label}</h3>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
              <button className="btn-primary mt-4 w-full">Create</button>
            </form>
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
        <input type="hidden" name="dynamicPeriods" value={Math.max(drawCount, 1)} />
        <label><span className="label">Postscreening capacity guide</span><input className="input mt-1" value={postCapacity} readOnly /></label>
        <label><span className="label">Postscreening cutoff percentage</span><input className="input mt-1" name="segmentCutoffPercent" defaultValue="0.5" step="0.01" min="0.01" max="0.99" /></label>
        <label><span className="label">Manual cutoff optional</span><input className="input mt-1" name="segmentCutoff" placeholder="Leave blank to compute from percentage" /></label>
        <button className="btn-primary md:col-span-3">Create custom run</button>
      </form>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Run</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Capacity</th><th className="p-3">Day limit</th><th className="p-3"></th></tr></thead>
          <tbody>{runs.map((run) => <tr key={run.id} className="border-t"><td className="p-3 font-bold">{run.name}</td><td className="p-3">{run.type}</td><td className="p-3"><StatusBadge status={run.status} /></td><td className="p-3">{run.capacity}</td><td className="p-3">{run.drawCount ?? defaultDrawCount(valuationCount, run.drawPercent)}</td><td className="p-3"><Link className="btn-secondary" href={`/admin/run/${run.id}`}>Control</Link></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}
