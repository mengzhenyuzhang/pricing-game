import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicEventJson } from "@/lib/game";
import type { SimulationEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

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
      revealValuationHistogram: run.revealValuationHistogram,
      currentDrawOrder: run.currentDrawOrder
    },
    results: activeTeams.map((team) => {
      const result = resultByTeam.get(team.id);
      const partial = result ? summarizeThroughDraw(result.eventsJson, run.currentDrawOrder) : null;
      return {
        rank: null,
        teamName: team.name,
        teamNumber: team.teamNumber,
        sales: partial?.sales ?? 0,
        lowSales: partial?.lowSales ?? 0,
        highSales: partial?.highSales ?? 0,
        revenue: partial?.revenue ?? 0,
        capacityUsed: partial?.capacityUsed ?? 0,
        eventsJson: result ? publicEventJson(JSON.stringify(partial?.events ?? [])) : "[]"
      };
    })
      .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales || a.capacityUsed - b.capacityUsed || a.teamNumber - b.teamNumber)
      .map((row, index) => ({ ...row, rank: row.revenue || row.sales ? index + 1 : null })),
    prices: run.revealPrices
      ? await prisma.activeDecision.findMany({
          where: { gameRunId: run.id },
          orderBy: { team: { teamNumber: "asc" } },
          select: { priceUsed: true, lowPriceUsed: true, highPriceUsed: true, bookingLimitUsed: true, team: { select: { teamNumber: true } } }
        })
      : []
  });
}

function summarizeThroughDraw(eventsJson: string, currentDrawOrder: number) {
  const events = (JSON.parse(eventsJson) as SimulationEvent[]).filter((event) => event.drawOrder <= currentDrawOrder);
  return events.reduce(
    (summary, event) => {
      if (!event.accepted) {
        summary.events.push(event);
        return summary;
      }
      summary.sales += 1;
      summary.revenue += event.revenueAdded;
      summary.capacityUsed = event.capacityUsedAfter;
      if (event.segment === "LOW") summary.lowSales += 1;
      if (event.segment === "HIGH") summary.highSales += 1;
      summary.events.push(event);
      return summary;
    },
    { sales: 0, lowSales: 0, highSales: 0, revenue: 0, capacityUsed: 0, events: [] as SimulationEvent[] }
  );
}
