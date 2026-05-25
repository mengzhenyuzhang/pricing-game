import { revalidatePath } from "next/cache";
import { addDayToRun, ensureMinimumDynamicPeriods, openDynamicPricingDay, runSimulation } from "@/lib/game";
import { prisma } from "@/lib/prisma";

export async function performRunControl(runId: string, action: string, periodId?: string | null) {
  let message = "Action complete.";
  await ensureMinimumDynamicPeriods(runId);

  if (action === "open") {
    const run = await prisma.gameRun.update({ where: { id: runId }, data: { status: "OPEN", currentDrawOrder: 0 } });
    await prisma.classSession.update({ where: { id: run.classSessionId }, data: { status: "GAME_ACTIVE" } });
    if (periodId) await prisma.roundPeriod.update({ where: { id: periodId }, data: { status: "OPEN", deadline: null } });
    if ((run.type === "DYNAMIC" || run.type === "POSTSCREENING") && !periodId) await openDynamicPricingDay(run.id, 1);
    message = (run.type === "DYNAMIC" || run.type === "POSTSCREENING") && !periodId ? "Day 1 pricing is open. Teams can submit prices." : periodId ? "Period opened. Teams can submit decisions." : "Run opened. Teams can submit decisions.";
  }

  if (action === "lock") {
    if (periodId) await prisma.roundPeriod.update({ where: { id: periodId }, data: { status: "LOCKED" } });
    else await prisma.gameRun.update({ where: { id: runId }, data: { status: "LOCKED" } });
    message = "Submissions locked.";
  }

  if (action === "simulate") {
    await runSimulation(runId);
    const run = await prisma.gameRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.type === "DYNAMIC" || run.type === "POSTSCREENING") await openDynamicPricingDay(runId, run.currentPeriod ?? 1);
    message = run.type === "DYNAMIC" || run.type === "POSTSCREENING" ? `Day ${run.currentPeriod ?? 1} pricing remains open. Use next-day controls after teams submit.` : "Day-by-day simulation is ready. Use the next-day controls.";
  }

  if (action === "reveal") {
    await prisma.gameRun.update({ where: { id: runId }, data: { status: "REVEALED" } });
    message = "Scoreboard revealed.";
  }

  if (action === "revealPrices") {
    await prisma.gameRun.update({ where: { id: runId }, data: { revealPrices: true } });
    message = "Team prices revealed.";
  }

  if (action === "revealHistogram") {
    await prisma.gameRun.update({ where: { id: runId }, data: { revealValuationHistogram: true } });
    message = "Valuation histogram revealed.";
  }

  if (action === "endRun") {
    await prisma.gameRun.update({
      where: { id: runId },
      data: {
        status: "REVEALED",
        revealValuationHistogram: true
      }
    });
    await prisma.roundPeriod.updateMany({ where: { gameRunId: runId, status: "OPEN" }, data: { status: "REVEALED" } });
    message = "Run ended. Scoreboard and arrival valuation histogram are now revealed.";
  }

  if (action === "nextDayNoArrival") {
    const result = await addDayToRun(runId, "NO_ARRIVAL");
    message = `Day ${result.day}: no arrival.`;
  }

  if (action === "nextDayRandomArrival") {
    const result = await addDayToRun(runId, "RANDOM");
    message = `Day ${result.day}: random arrival drawn.`;
  }

  if (action === "nextDayLowArrival") {
    const result = await addDayToRun(runId, "LOW");
    message = `Day ${result.day}: below-cutoff arrival drawn.`;
  }

  if (action === "nextDayHighArrival") {
    const result = await addDayToRun(runId, "HIGH");
    message = `Day ${result.day}: above-cutoff arrival drawn.`;
  }

  if (action === "reset") {
    await prisma.teamResult.deleteMany({ where: { gameRunId: runId } });
    await prisma.activeDecision.deleteMany({ where: { gameRunId: runId } });
    await prisma.submission.deleteMany({ where: { gameRunId: runId } });
    await prisma.customerDraw.deleteMany({ where: { gameRunId: runId } });
    await prisma.gameRun.update({ where: { id: runId }, data: { status: "DRAFT", revealPrices: false, revealValuationHistogram: false, currentDrawOrder: 0 } });
    await prisma.roundPeriod.updateMany({ where: { gameRunId: runId }, data: { status: "DRAFT" } });
    message = "Run reset.";
  }

  safeRevalidate(`/admin/run/${runId}`);
  safeRevalidate("/scoreboard");
  return message;
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // The run-control route redirects or reloads after each action, so a failed
    // cache revalidation must not turn a successful classroom click into an error.
  }
}
