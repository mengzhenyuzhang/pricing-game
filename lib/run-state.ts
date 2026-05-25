import { prisma } from "@/lib/prisma";

export async function runStateSignature(runId: string) {
  const run = await prisma.gameRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      currentDrawOrder: true,
      currentPeriod: true,
      revealPrices: true,
      revealValuationHistogram: true,
      decisions: {
        select: {
          id: true,
          teamId: true,
          periodId: true,
          submittedAt: true
        }
      },
      draws: {
        select: {
          id: true,
          drawOrder: true
        }
      },
      results: {
        select: {
          id: true,
          updatedAt: true
        }
      }
    }
  });
  if (!run) return "missing";

  const latestDecision = latestTimestamp(run.decisions.map((decision) => decision.submittedAt));
  const latestResult = latestTimestamp(run.results.map((result) => result.updatedAt));
  return [
    run.id,
    run.status,
    run.currentDrawOrder,
    run.currentPeriod ?? "none",
    run.revealPrices ? "prices" : "hidden-prices",
    run.revealValuationHistogram ? "histogram" : "hidden-histogram",
    run.decisions.length,
    latestDecision,
    run.draws.length,
    latestResult
  ].join(":");
}

function latestTimestamp(dates: Date[]) {
  return dates.length ? Math.max(...dates.map((date) => date.getTime())) : 0;
}
