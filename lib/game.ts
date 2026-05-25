import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { simulateDynamic, simulatePostscreening, simulateStatic } from "@/lib/simulation";
import { defaultDrawCount } from "@/lib/team-generation";
import type { Decision, Draw, Segment, SimulationResult } from "@/lib/types";

export const MINIMUM_GAME_DAYS = 10;

export async function getCurrentClassSession() {
  let session = await prisma.classSession.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!session) {
    const code = `CLASS${Math.floor(1000 + Math.random() * 9000)}`;
    session = await prisma.classSession.create({
      data: { name: "Default Class Session", code, minTeamSize: 4, maxTeamSize: 5, targetDrawPercent: 0.7 }
    });
  }
  return session;
}

export async function getPlayableRun(classSessionId?: string) {
  const period = await prisma.roundPeriod.findFirst({
    where: { status: "OPEN", gameRun: { status: { in: ["OPEN", "SIMULATED", "REVEALED"] }, type: { in: ["DYNAMIC", "POSTSCREENING"] }, ...(classSessionId ? { classSessionId } : {}) } },
    include: { gameRun: true },
    orderBy: [{ updatedAt: "desc" }]
  });
  if (period) return { run: period.gameRun, period };

  const run = await prisma.gameRun.findFirst({
    where: { status: "OPEN", type: "STATIC", ...(classSessionId ? { classSessionId } : {}) },
    orderBy: { updatedAt: "desc" }
  });
  return run ? { run, period: null } : null;
}

export async function buildDraws(gameRunId: string): Promise<Draw[]> {
  const draws = await prisma.customerDraw.findMany({
    where: { gameRunId, useInRun: true },
    orderBy: [{ periodNumber: "asc" }, { drawOrder: "asc" }]
  });
  return draws.map((draw) => ({
    customerId: draw.customerLabel,
    valuationAmount: draw.valuationAmountSnapshot,
    segment: draw.segment as Segment,
    drawOrder: draw.drawOrder,
    periodNumber: draw.periodNumber
  }));
}

export async function buildStaticDecisions(gameRunId: string): Promise<Decision[]> {
  const decisions = await prisma.activeDecision.findMany({
    where: { gameRunId },
    include: { team: true }
  });
  return decisions.map((decision) => ({
    teamId: decision.teamId,
    teamNumber: decision.team.teamNumber,
    teamName: decision.team.name,
    priceUsed: decision.priceUsed,
    lowPriceUsed: decision.lowPriceUsed,
    highPriceUsed: decision.highPriceUsed,
    bookingLimitUsed: decision.bookingLimitUsed,
    submittedAt: decision.submittedAt
  }));
}

export async function buildDynamicDecisions(gameRunId: string): Promise<Decision[]> {
  const draws = await prisma.customerDraw.findMany({ where: { gameRunId, useInRun: true, periodNumber: { not: null } } });
  const periodNumbers = [...new Set(draws.map((draw) => draw.periodNumber).filter((periodNumber): periodNumber is number => Boolean(periodNumber)))];
  if (!periodNumbers.length) return [];
  const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: gameRunId } });
  const periods = await prisma.roundPeriod.findMany({
    where: { gameRunId, periodNumber: { in: periodNumbers } },
    orderBy: { periodNumber: "asc" }
  });
  const teams = await prisma.team.findMany({ where: { classSessionId: run.classSessionId, active: true }, orderBy: { teamNumber: "asc" } });
  const raw = await prisma.activeDecision.findMany({
    where: { gameRunId },
    include: { team: true, period: true }
  });
  const key = (teamId: string, periodId: string) => `${teamId}:${periodId}`;
  const byKey = new Map(raw.filter((d) => d.periodId).map((d) => [key(d.teamId, d.periodId!), d]));
  const decisions: Decision[] = [];
  for (const team of teams) {
    let lastPrice: number | null = null;
    for (const period of periods) {
      const decision = byKey.get(key(team.id, period.id));
      if (decision?.priceUsed) lastPrice = decision.priceUsed;
      if (!lastPrice) throw new Error(`Missing price for ${team.name}, ${period.label}`);
      decisions.push({
        teamId: team.id,
        teamNumber: team.teamNumber,
        teamName: team.name,
        priceUsed: lastPrice,
        periodNumber: period.periodNumber,
        submittedAt: decision?.submittedAt
      });
    }
  }
  return decisions;
}

export async function runSimulation(gameRunId: string) {
  const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: gameRunId } });
  const draws = await buildDraws(gameRunId);
  if (draws.length === 0) {
    await prisma.gameRun.update({ where: { id: gameRunId }, data: { status: run.status === "REVEALED" ? "REVEALED" : "SIMULATED", currentDrawOrder: run.currentDrawOrder } });
    return [];
  }

  let results: SimulationResult[];
  if (run.type === "DYNAMIC") {
    results = simulateDynamic(draws, await buildDynamicDecisions(gameRunId), run.capacity);
  } else if (run.type === "POSTSCREENING") {
    results = simulatePostscreening(draws, await buildDynamicDecisions(gameRunId), run.capacity);
  } else {
    results = simulateStatic(draws, await buildStaticDecisions(gameRunId), run.capacity);
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamResult.deleteMany({ where: { gameRunId } });
    for (const result of results) {
      await tx.teamResult.create({
        data: {
          gameRunId,
          teamId: result.teamId,
          sales: result.sales,
          lowSales: result.lowSales,
          highSales: result.highSales,
          revenue: result.revenue,
          capacityUsed: result.capacityUsed,
          rank: result.rank,
          eventsJson: JSON.stringify(result.events)
        }
      });
    }
    await tx.gameRun.update({ where: { id: gameRunId }, data: { status: run.status === "REVEALED" ? "REVEALED" : "SIMULATED", currentDrawOrder: run.currentDrawOrder } });
    await tx.roundPeriod.updateMany({
      where: { gameRunId, status: "LOCKED" },
      data: { status: "SIMULATED" }
    });
  });
  return results;
}

export async function ensureDrawForRun(gameRunId: string) {
  const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: gameRunId }, include: { periods: true } });
  const existing = await prisma.customerDraw.count({ where: { gameRunId } });
  if (existing > 0) return;
  const participants = await prisma.participant.findMany({ where: { classSessionId: run.classSessionId }, orderBy: { checkedInAt: "asc" } });
  const count = defaultDrawCount(participants.length, run.drawPercent, run.drawCount);
  const selected = shuffle(participants).slice(0, count);
  const ordered = run.type === "POSTSCREENING"
    ? [...selected].sort((a, b) => {
        const aSegment = segmentFor(run.type, a.valuationAmount, run.segmentCutoff);
        const bSegment = segmentFor(run.type, b.valuationAmount, run.segmentCutoff);
        if (aSegment !== bSegment) return aSegment === "LOW" ? -1 : 1;
        return a.valuationAmount - b.valuationAmount;
      })
    : selected;
  const data = ordered.map((participant, index) => {
    let periodNumber: number | null = null;
    if (run.type === "DYNAMIC" && run.periods.length > 0) {
      periodNumber = (index % (run.dynamicPeriods || run.periods.length)) + 1;
    }
    return {
      gameRunId,
      participantId: participant.id,
      valuationAmountSnapshot: participant.valuationAmount,
      customerLabel: `P${String(index + 1).padStart(3, "0")}`,
      segment: segmentFor(run.type, participant.valuationAmount, run.segmentCutoff),
      drawOrder: index + 1,
      periodNumber,
      useInRun: true
    };
  });
  if (data.length) await prisma.customerDraw.createMany({ data });
}

export async function addDayToRun(gameRunId: string, mode: "NO_ARRIVAL" | "RANDOM" | "LOW" | "HIGH") {
  await ensureMinimumDynamicPeriods(gameRunId);
  const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: gameRunId }, include: { periods: true } });
  const usesDailyPricing = run.type === "DYNAMIC" || run.type === "POSTSCREENING";
  const nextDay = usesDailyPricing ? run.currentPeriod ?? run.currentDrawOrder + 1 : run.currentDrawOrder + 1;
  const dynamicDayCount = Math.max(run.dynamicPeriods, MINIMUM_GAME_DAYS);
  if (usesDailyPricing && nextDay > dynamicDayCount) {
    throw new Error("All pricing days have already been completed.");
  }
  await prisma.customerDraw.deleteMany({ where: { gameRunId, drawOrder: nextDay } });
  if (mode === "NO_ARRIVAL") {
    await advanceDynamicPeriodIfNeeded(run.id, run.type, nextDay, dynamicDayCount, run.status === "REVEALED");
    await prisma.gameRun.update({ where: { id: gameRunId }, data: { currentDrawOrder: nextDay, status: run.status === "REVEALED" ? "REVEALED" : "SIMULATED" } });
    return { day: nextDay, arrival: false };
  }

  const alreadyDrawn = await prisma.customerDraw.findMany({ where: { gameRunId, participantId: { not: null } }, select: { participantId: true } });
  const usedIds = alreadyDrawn.map((draw) => draw.participantId!).filter(Boolean);
  const cutoff = run.segmentCutoff ?? 3500;
  const participants = await prisma.participant.findMany({
    where: {
      classSessionId: run.classSessionId,
      id: usedIds.length ? { notIn: usedIds } : undefined,
      ...(run.type === "POSTSCREENING" && mode === "LOW" ? { valuationAmount: { lt: cutoff } } : {}),
      ...(run.type === "POSTSCREENING" && mode === "HIGH" ? { valuationAmount: { gte: cutoff } } : {})
    }
  });
  const pool = participants.length
    ? participants
    : await prisma.participant.findMany({
        where: {
          classSessionId: run.classSessionId,
          ...(run.type === "POSTSCREENING" && mode === "LOW" ? { valuationAmount: { lt: cutoff } } : {}),
          ...(run.type === "POSTSCREENING" && mode === "HIGH" ? { valuationAmount: { gte: cutoff } } : {})
        }
      });
  if (!pool.length) throw new Error("No matching checked-in participants are available to draw.");
  const participant = pool[Math.floor(Math.random() * pool.length)];
  const segment = run.type === "POSTSCREENING" ? segmentFor(run.type, participant.valuationAmount, run.segmentCutoff) : "UNKNOWN";
  await prisma.customerDraw.create({
    data: {
      gameRunId,
      participantId: participant.id,
      valuationAmountSnapshot: participant.valuationAmount,
      customerLabel: `Day ${nextDay}`,
      segment,
      drawOrder: nextDay,
      periodNumber: usesDailyPricing ? nextDay : null,
      useInRun: true
    }
  });
  await prisma.gameRun.update({ where: { id: gameRunId }, data: { currentDrawOrder: nextDay, status: run.status === "REVEALED" ? "REVEALED" : "SIMULATED" } });
  await runSimulation(gameRunId);
  await advanceDynamicPeriodIfNeeded(run.id, run.type, nextDay, dynamicDayCount, run.status === "REVEALED");
  return { day: nextDay, arrival: true, segment, valuationAmount: participant.valuationAmount };
}

export async function openDynamicPricingDay(gameRunId: string, day: number) {
  await ensureMinimumDynamicPeriods(gameRunId);
  const period = await prisma.roundPeriod.upsert({
    where: { gameRunId_periodNumber: { gameRunId, periodNumber: day } },
    update: { status: "OPEN", label: `Day ${day}`, instructions: `Submit your team's price for day ${day}.`, deadline: null },
    create: { gameRunId, periodNumber: day, label: `Day ${day}`, status: "OPEN", instructions: `Submit your team's price for day ${day}.` }
  });
  await prisma.roundPeriod.updateMany({ where: { gameRunId, id: { not: period.id }, status: "OPEN" }, data: { status: "LOCKED" } });
  await prisma.gameRun.update({ where: { id: gameRunId }, data: { currentPeriod: day } });
}

export async function ensureMinimumDynamicPeriods(gameRunId: string) {
  const run = await prisma.gameRun.findUnique({ where: { id: gameRunId }, include: { periods: true } });
  if (!run || (run.type !== "DYNAMIC" && run.type !== "POSTSCREENING")) return;
  if (run.dynamicPeriods < MINIMUM_GAME_DAYS) {
    await prisma.gameRun.update({ where: { id: gameRunId }, data: { dynamicPeriods: MINIMUM_GAME_DAYS } });
  }
  const existing = new Set(run.periods.map((period) => period.periodNumber));
  for (let day = 1; day <= MINIMUM_GAME_DAYS; day += 1) {
    if (!existing.has(day)) {
      await prisma.roundPeriod.create({
        data: {
          gameRunId,
          periodNumber: day,
          label: `Day ${day}`,
          instructions: `Submit your team's price for day ${day}.`
        }
      });
    }
  }
}

async function advanceDynamicPeriodIfNeeded(gameRunId: string, type: string, completedDay: number, dynamicPeriods: number, revealed: boolean) {
  if (type !== "DYNAMIC" && type !== "POSTSCREENING") return;
  await prisma.roundPeriod.updateMany({ where: { gameRunId, periodNumber: completedDay }, data: { status: "SIMULATED" } });
  if (completedDay < dynamicPeriods) {
    await openDynamicPricingDay(gameRunId, completedDay + 1);
    await prisma.gameRun.update({ where: { id: gameRunId }, data: { status: revealed ? "REVEALED" : "SIMULATED" } });
  } else {
    await prisma.gameRun.update({ where: { id: gameRunId }, data: { currentPeriod: completedDay, status: revealed ? "REVEALED" : "SIMULATED" } });
  }
}

function segmentFor(type: string, amount: number, cutoff?: number | null) {
  if (type !== "POSTSCREENING") return "UNKNOWN" as const;
  const threshold = cutoff ?? 3500;
  return amount < threshold ? ("LOW" as const) : ("HIGH" as const);
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function csv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const quote = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\n");
}

export function publicEventJson(eventsJson: string) {
  const events = JSON.parse(eventsJson) as Array<Record<string, unknown>>;
  return JSON.stringify(events.map(({ valuationAmount: _valuationAmount, ...event }) => event));
}

export type Tx = Prisma.TransactionClient;
