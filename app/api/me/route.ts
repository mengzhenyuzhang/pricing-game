import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/participant-session";

export async function GET() {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Not checked in", redirectTo: "/join" }, { status: 401 });
  return NextResponse.json({
    participantId: participant.id,
    displayName: participant.displayName,
    attendanceMode: participant.attendanceMode,
    classSessionStatus: participant.classSession.status,
    teamId: participant.teamId,
    teamName: participant.team?.name ?? null,
    redirectTo: participant.teamId ? "/team" : null
  });
}
