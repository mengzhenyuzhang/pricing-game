import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashParticipantToken } from "@/lib/token";

const participantIdCookie = "rm_participant_id";
const participantTokenCookie = "rm_participant_token";

export async function createParticipantSession(participantId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.participant.update({
    where: { id: participantId },
    data: { sessionTokenHash: hashParticipantToken(token), lastSeenAt: new Date() }
  });
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  };
  cookies().set(participantIdCookie, participantId, options);
  cookies().set(participantTokenCookie, token, options);
}

export async function getCurrentParticipant() {
  const participantId = cookies().get(participantIdCookie)?.value;
  const token = cookies().get(participantTokenCookie)?.value;
  if (!participantId || !token) return null;
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: { classSession: true, team: { include: { participants: { orderBy: { displayName: "asc" } } } } }
  });
  if (!participant?.sessionTokenHash || participant.sessionTokenHash !== hashParticipantToken(token)) return null;
  await prisma.participant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } });
  return participant;
}

export async function requireParticipant() {
  const participant = await getCurrentParticipant();
  if (!participant) redirect("/join");
  return participant;
}
