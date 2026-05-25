import { NextResponse } from "next/server";
import { getPlayableRun } from "@/lib/game";
import { getCurrentParticipant } from "@/lib/participant-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ redirectTo: "/join", signature: "signed-out" }, { status: 401 });
  if (!participant.teamId) return NextResponse.json({ redirectTo: "/lobby", signature: "unassigned" });

  const playable = await getPlayableRun(participant.classSessionId);
  const resultsRun = playable?.run ?? await prisma.gameRun.findFirst({
    where: { classSessionId: participant.classSessionId, status: { in: ["SIMULATED", "REVEALED"] } },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({
    redirectTo: "/team",
    signature: teamPageSignature(
      playable?.run.id ?? null,
      playable?.period?.id ?? null,
      playable?.run.status ?? null,
      playable?.period?.status ?? null,
      resultsRun?.id ?? null,
      resultsRun?.currentDrawOrder ?? 0
    )
  });
}

function teamPageSignature(runId: string | null, periodId: string | null, runStatus: string | null, periodStatus: string | null, resultsRunId: string | null, currentDrawOrder: number) {
  return [runId ?? "no-open-run", periodId ?? "run-level", runStatus ?? "none", periodStatus ?? "none", resultsRunId ?? "no-results", currentDrawOrder].join(":");
}
