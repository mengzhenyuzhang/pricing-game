import type { Decision, Draw, SimulationEvent, SimulationResult } from "@/lib/types";

function emptyResult(decision: Decision): SimulationResult {
  return {
    teamId: decision.teamId,
    teamNumber: decision.teamNumber,
    teamName: decision.teamName,
    sales: 0,
    lowSales: 0,
    highSales: 0,
    revenue: 0,
    capacityUsed: 0,
    rank: 0,
    priceUsed: decision.priceUsed,
    lowPriceUsed: decision.lowPriceUsed,
    highPriceUsed: decision.highPriceUsed,
    bookingLimitUsed: decision.bookingLimitUsed,
    events: []
  };
}

export function rankResults(results: SimulationResult[]): SimulationResult[] {
  const sorted = [...results].sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    if (b.sales !== a.sales) return b.sales - a.sales;
    if (a.capacityUsed !== b.capacityUsed) return a.capacityUsed - b.capacityUsed;
    return a.teamNumber - b.teamNumber;
  });

  return sorted.map((result, index) => ({ ...result, rank: index + 1 }));
}

export function simulateStatic(draws: Draw[], decisions: Decision[], capacity: number): SimulationResult[] {
  return rankResults(
    decisions.map((decision) => {
      if (!decision.priceUsed || decision.priceUsed <= 0) {
        throw new Error(`Missing static price for ${decision.teamName}`);
      }
      const result = emptyResult(decision);
      for (const draw of draws) {
        const accepted = result.capacityUsed < capacity && draw.valuationAmount >= decision.priceUsed;
        const event: SimulationEvent = {
          drawOrder: draw.drawOrder,
          customerId: draw.customerId,
          segment: draw.segment,
          periodNumber: draw.periodNumber ?? null,
          priceApplied: decision.priceUsed,
          accepted,
          revenueAdded: accepted ? decision.priceUsed : 0,
          capacityUsedAfter: result.capacityUsed + (accepted ? 1 : 0),
          valuationAmount: draw.valuationAmount
        };
        if (accepted) {
          result.sales += 1;
          result.revenue += decision.priceUsed;
          result.capacityUsed += 1;
        }
        result.events.push(event);
      }
      return result;
    })
  );
}

export function simulateDynamic(draws: Draw[], decisions: Decision[], capacity: number): SimulationResult[] {
  const byTeam = new Map<string, Decision[]>();
  for (const decision of decisions) {
    byTeam.set(decision.teamId, [...(byTeam.get(decision.teamId) ?? []), decision]);
  }

  const results: SimulationResult[] = [];
  for (const teamDecisions of byTeam.values()) {
    const ordered = teamDecisions.sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));
    const first = ordered[0];
    const result = emptyResult(first);
    const priceByPeriod = new Map<number, number>();
    let lastPrice: number | null = null;
    for (const decision of ordered) {
      if (decision.priceUsed && decision.priceUsed > 0) lastPrice = decision.priceUsed;
      if (!lastPrice) throw new Error(`Missing dynamic price for ${decision.teamName}`);
      if (decision.periodNumber) priceByPeriod.set(decision.periodNumber, lastPrice);
    }

    for (const draw of draws) {
      const periodNumber = draw.periodNumber ?? 1;
      const price = priceByPeriod.get(periodNumber);
      if (!price) throw new Error(`Missing period ${periodNumber} price for ${first.teamName}`);
      const accepted = result.capacityUsed < capacity && draw.valuationAmount >= price;
      if (accepted) {
        result.sales += 1;
        result.revenue += price;
        result.capacityUsed += 1;
      }
      result.events.push({
        drawOrder: draw.drawOrder,
        customerId: draw.customerId,
        segment: draw.segment,
        periodNumber,
        priceApplied: price,
        accepted,
        revenueAdded: accepted ? price : 0,
        capacityUsedAfter: result.capacityUsed,
        valuationAmount: draw.valuationAmount
      });
    }
    results.push(result);
  }

  return rankResults(results);
}

export function simulatePostscreening(draws: Draw[], decisions: Decision[], capacity: number): SimulationResult[] {
  if (decisions.some((decision) => decision.periodNumber != null || decision.priceUsed != null)) {
    return simulateDailyPostscreening(draws, decisions, capacity);
  }

  return rankResults(
    decisions.map((decision) => {
      if (!decision.lowPriceUsed || !decision.highPriceUsed || decision.bookingLimitUsed == null) {
        throw new Error(`Missing postscreening decision for ${decision.teamName}`);
      }
      const result = emptyResult(decision);
      const orderedDraws = [...draws].sort((a, b) => {
        if (a.segment !== b.segment) return a.segment === "LOW" ? -1 : 1;
        return a.drawOrder - b.drawOrder;
      });

      for (const draw of orderedDraws) {
        const isLow = draw.segment === "LOW";
        const price = isLow ? decision.lowPriceUsed : decision.highPriceUsed;
        const canSellLow = !isLow || result.lowSales < decision.bookingLimitUsed;
        const accepted = draw.valuationAmount >= price && canSellLow && result.sales < capacity;
        if (accepted) {
          result.sales += 1;
          result.capacityUsed += 1;
          result.revenue += price;
          if (isLow) result.lowSales += 1;
          else result.highSales += 1;
        }
        result.events.push({
          drawOrder: draw.drawOrder,
          customerId: draw.customerId,
          segment: draw.segment,
          periodNumber: draw.periodNumber ?? null,
          priceApplied: price,
          accepted,
          revenueAdded: accepted ? price : 0,
          capacityUsedAfter: result.capacityUsed,
          valuationAmount: draw.valuationAmount
        });
      }
      return result;
    })
  );
}

function simulateDailyPostscreening(draws: Draw[], decisions: Decision[], capacity: number): SimulationResult[] {
  const byTeam = new Map<string, Decision[]>();
  for (const decision of decisions) {
    byTeam.set(decision.teamId, [...(byTeam.get(decision.teamId) ?? []), decision]);
  }

  const results: SimulationResult[] = [];
  for (const teamDecisions of byTeam.values()) {
    const ordered = teamDecisions.sort((a, b) => (a.periodNumber ?? 0) - (b.periodNumber ?? 0));
    const first = ordered[0];
    const result = emptyResult(first);
    const priceByPeriod = new Map<number, number>();
    let lastPrice: number | null = null;
    for (const decision of ordered) {
      if (decision.priceUsed && decision.priceUsed > 0) lastPrice = decision.priceUsed;
      if (!lastPrice) throw new Error(`Missing postscreening price for ${decision.teamName}`);
      if (decision.periodNumber) priceByPeriod.set(decision.periodNumber, lastPrice);
    }

    for (const draw of draws) {
      const periodNumber = draw.periodNumber ?? draw.drawOrder;
      const price = priceByPeriod.get(periodNumber);
      if (!price) throw new Error(`Missing day ${periodNumber} price for ${first.teamName}`);
      const accepted = result.sales < capacity && draw.valuationAmount >= price;
      if (accepted) {
        result.sales += 1;
        result.capacityUsed += 1;
        result.revenue += price;
        if (draw.segment === "LOW") result.lowSales += 1;
        if (draw.segment === "HIGH") result.highSales += 1;
      }
      result.events.push({
        drawOrder: draw.drawOrder,
        customerId: draw.customerId,
        segment: draw.segment,
        periodNumber,
        priceApplied: price,
        accepted,
        revenueAdded: accepted ? price : 0,
        capacityUsedAfter: result.capacityUsed,
        valuationAmount: draw.valuationAmount
      });
    }
    results.push(result);
  }

  return rankResults(results);
}

export function serializePublicScoreboard(
  results: SimulationResult[],
  revealPrices: boolean
): Array<Omit<SimulationResult, "events"> & { events?: never }> {
  return results.map(({ events: _events, ...result }) => ({
    ...result,
    priceUsed: revealPrices ? result.priceUsed ?? null : null,
    lowPriceUsed: revealPrices ? result.lowPriceUsed ?? null : null,
    highPriceUsed: revealPrices ? result.highPriceUsed ?? null : null,
    bookingLimitUsed: revealPrices ? result.bookingLimitUsed ?? null : null
  }));
}
