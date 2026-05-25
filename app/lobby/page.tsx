import { redirect } from "next/navigation";
import { requireParticipant } from "@/lib/participant-session";
import { LobbyClient } from "./lobby-client";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const participant = await requireParticipant();
  if (participant.teamId) redirect("/team");
  return <LobbyClient displayName={participant.displayName} attendanceMode={participant.attendanceMode} sessionName={participant.classSession.name} />;
}
