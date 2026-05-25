import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const openSession = await prisma.classSession.findFirst({ where: { status: "CHECKIN_OPEN" }, orderBy: { updatedAt: "desc" } });
  if (openSession) redirect(`/join/${openSession.code}`);
  return (
    <div className="mx-auto max-w-2xl text-center">
      <section className="panel p-8">
        <h1 className="text-4xl font-black">Pricing Game</h1>
        <p className="mt-4 text-lg text-slate-700">No active check-in session is open yet.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link className="btn-secondary" href="/scoreboard">Scoreboard</Link>
          <Link className="btn-primary" href="/admin">Instructor Admin</Link>
        </div>
      </section>
    </div>
  );
}
