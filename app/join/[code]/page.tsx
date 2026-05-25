import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JoinForm } from "../join-form";

export const dynamic = "force-dynamic";

export default async function JoinCodePage({ params }: { params: { code: string } }) {
  const session = await prisma.classSession.findUnique({ where: { code: params.code.toUpperCase() } });
  if (!session) notFound();
  if (session.status !== "CHECKIN_OPEN") return <div className="panel mx-auto max-w-2xl p-8 text-center text-xl font-bold">Check-in is currently closed. Ask the instructor.</div>;
  return <JoinForm code={session.code} sessionName={session.name} />;
}
