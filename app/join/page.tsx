import { prisma } from "@/lib/prisma";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const session = await prisma.classSession.findFirst({ where: { status: "CHECKIN_OPEN" }, orderBy: { updatedAt: "desc" } });
  if (!session) return <div className="panel mx-auto max-w-2xl p-8 text-center text-xl font-bold">No active check-in session is open. Ask the instructor.</div>;
  return <JoinForm code={session.code} sessionName={session.name} />;
}
