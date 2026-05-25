import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicEventJson } from "@/lib/game";

export async function GET() {
  const run = await prisma.gameRun.findFirst({
    where: { status: { in: ["SIMULATED", "REVEALED"] } },
    orderBy: { updatedAt: "desc" },
    include: { results: { include: { team: true }, orderBy: { rank: "asc" } } }
  });
  if (!run) return NextResponse.json({ run: null, results: [] });
  const activeTeams = await prisma.team.findMany({ where: { classSessionId: run.classSessionId, active: true }, orderBy: { teamNumber: "asc" } });
  const resultByTeam = new Map(run.results.map((result) => [result.teamId, result]));
  return NextResponse.json({
    run: {
      id: run.id,
      name: run.name,
      type: run.type,
      status: run.status,
      revealPrices: run.revealPrices,
      revealValuationHistogram: run.revealValuationHistogram
    },
    results: activeTeams.map((team) => {
      const result = resultByTeam.get(team.id);
      return {
        rank: result?.rank ?? null,
        teamName: team.name,
        teamNumber: team.teamNumber,
        sales: result?.sales ?? 0,
        lowSales: result?.lowSales ?? 0,
        highSales: result?.highSales ?? 0,
        revenue: result?.revenue ?? 0,
        capacityUsed: result?.capacityUsed ?? 0,
        eventsJson: result ? publicEventJson(result.eventsJson) : "[]"
      };
    }).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.teamNumber - b.teamNumber),
    prices: run.revealPrices
      ? await prisma.activeDecision.findMany({
          where: { gameRunId: run.id },
          orderBy: { team: { teamNumber: "asc" } },
          select: { priceUsed: true, lowPriceUsed: true, highPriceUsed: true, bookingLimitUsed: true, team: { select: { teamNumber: true } } }
        })
      : []
  });
}
