import { addValuation } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { getCurrentClassSession } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { Histogram } from "./valuation-histogram";

export const dynamic = "force-dynamic";

export default async function ValuationsPage({ searchParams }: { searchParams: { classSessionId?: string } }) {
  await requireAdmin();
  const sessions = await prisma.classSession.findMany({ orderBy: { updatedAt: "desc" } });
  const current = searchParams.classSessionId
    ? await prisma.classSession.findUniqueOrThrow({ where: { id: searchParams.classSessionId } })
    : await getCurrentClassSession();
  const valuations = await prisma.valuation.findMany({ where: { classSessionId: current.id }, orderBy: { amount: "asc" } });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Valuations</h1>
        <a className="btn-secondary" href={`/api/admin/export/valuations?classSessionId=${current.id}`}>Export CSV</a>
      </div>
      <form className="panel flex flex-wrap items-end gap-3 p-4">
        <label><span className="label">Class session</span><select className="input mt-1" name="classSessionId" defaultValue={current.id}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
        <button className="btn-secondary">View</button>
      </form>
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <form action={addValuation} className="panel space-y-4 p-5">
          <h2 className="text-2xl font-black">Add valuation</h2>
          <input type="hidden" name="classSessionId" value={current.id} />
          <label className="block"><span className="label">Amount</span><input className="input mt-1" name="amount" required /></label>
          <label className="block"><span className="label">Alias optional</span><input className="input mt-1" name="studentAlias" /></label>
          <label className="block"><span className="label">Segment</span><select className="input mt-1" name="segment"><option>UNKNOWN</option><option>LOW</option><option>HIGH</option></select></label>
          <button className="btn-primary">Add</button>
        </form>
        <div className="panel p-5"><h2 className="text-2xl font-black">{valuations.length} responses</h2><Histogram values={valuations.map((v) => v.amount)} /></div>
      </section>
      <section className="panel max-h-[480px] overflow-auto">
        <table className="w-full"><thead className="sticky top-0 bg-slate-100 text-left text-sm uppercase text-slate-600"><tr><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Segment</th><th className="p-3">Alias</th></tr></thead><tbody>{valuations.map((v) => <tr className="border-t" key={v.id}><td className="p-3">{v.customerId}</td><td className="p-3">${v.amount.toLocaleString()}</td><td className="p-3">{v.segment}</td><td className="p-3">{v.studentAlias}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
