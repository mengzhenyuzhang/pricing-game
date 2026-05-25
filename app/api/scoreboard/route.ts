import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicEventJson } from "@/lib/game";
import { buildAdaptiveHistogram } from "@/lib/histogram";
import type { SimulationEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const classSession = await prisma.classSession.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!classSession) return NextResponse.json({ run: null, results: [], runs: [] });
  const runs = await prisma.gameRun.findMany({
    where: { classSessionId: classSession.id, status: { in: ["SIMULATED", "REVEALED"] } },
    orderBy: { updatedAt: "desc" },
    include: { results: { include: { team: true }, orderBy: { rank: "asc" } } }
  });
  if (!runs.length) return NextResponse.json({ run: null, results: [], runs: [] });
  const historicalRuns = await Promise.all(runs.map((run) => serializeRun(run)));
  return NextResponse.json({
    ...historicalRuns[0],
    runs: historicalRuns
  });
}

async function serializeRun(run: Awaited<ReturnType<typeof prisma.gameRun.findMany>>[number] & { results: Array<{ teamId: string; eventsJson: string }> }) {
  const activeTeams = await prisma.team.findMany({ where: { classSessionId: run.classSessionId, active: true }, orderBy: { teamNumber: "asc" } });
  const valuationHistogram = run.revealValuationHistogram
    ? buildAdaptiveHistogram(
        (
          await prisma.customerDraw.findMany({
            where: { gameRunId: run.id, useInRun: true, drawOrder: { lte: run.currentDrawOrder } },
            select: { valuationAmountSnapshot: true }
          })
        ).map((draw) => draw.valuationAmountSnapshot)
      )
    : [];
  const resultByTeam = new Map(run.results.map((result) => [result.teamId, result]));
  return {
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
      : [],
    valuationHistogram
  };
}

function summarizeThroughDraw(eventsJson: string, currentDrawOrder: number) {
  const events = safeEvents(eventsJson).filter((event) => event.drawOrder <= currentDrawOrder);
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

function safeEvents(eventsJson: string) {
  try {
    const parsed = JSON.parse(eventsJson);
    return Array.isArray(parsed) ? parsed as SimulationEvent[] : [];
  } catch {
    return [];
  }
}
