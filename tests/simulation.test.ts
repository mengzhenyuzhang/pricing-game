import { describe, expect, it } from "vitest";
import { serializePublicScoreboard, simulateDynamic, simulatePostscreening, simulateStatic } from "../lib/simulation";
import type { Decision, Draw } from "../lib/types";

const team = (partial: Partial<Decision> = {}): Decision => ({
  teamId: partial.teamId ?? "t1",
  teamNumber: partial.teamNumber ?? 1,
  teamName: partial.teamName ?? "Team 1",
  ...partial
});

describe("simulation logic", () => {
  it("simulates static pricing", () => {
    const draws: Draw[] = [100, 500, 1000, 2000].map((valuationAmount, index) => ({
      customerId: `C${index}`,
      valuationAmount,
      segment: "UNKNOWN",
      drawOrder: index + 1
    }));
    const [result] = simulateStatic(draws, [team({ priceUsed: 1000 })], 100);
    expect(result.sales).toBe(2);
    expect(result.revenue).toBe(2000);
  });

  it("simulates dynamic periods with different prices", () => {
    const draws: Draw[] = [
      { customerId: "C1", valuationAmount: 500, segment: "UNKNOWN", drawOrder: 1, periodNumber: 1 },
      { customerId: "C2", valuationAmount: 900, segment: "UNKNOWN", drawOrder: 2, periodNumber: 1 },
      { customerId: "C3", valuationAmount: 1500, segment: "UNKNOWN", drawOrder: 3, periodNumber: 2 },
      { customerId: "C4", valuationAmount: 1700, segment: "UNKNOWN", drawOrder: 4, periodNumber: 2 }
    ];
    const [result] = simulateDynamic(draws, [team({ priceUsed: 800, periodNumber: 1 }), team({ priceUsed: 1600, periodNumber: 2 })], 100);
    expect(result.sales).toBe(2);
    expect(result.revenue).toBe(2400);
  });

  it("enforces postscreening booking limits, capacity, and high price", () => {
    const draws: Draw[] = [
      { customerId: "L1", valuationAmount: 800, segment: "LOW", drawOrder: 1 },
      { customerId: "L2", valuationAmount: 900, segment: "LOW", drawOrder: 2 },
      { customerId: "H1", valuationAmount: 2000, segment: "HIGH", drawOrder: 3 },
      { customerId: "H2", valuationAmount: 2200, segment: "HIGH", drawOrder: 4 }
    ];
    const [result] = simulatePostscreening(draws, [team({ lowPriceUsed: 700, highPriceUsed: 2000, bookingLimitUsed: 1 })], 2);
    expect(result.lowSales).toBe(1);
    expect(result.highSales).toBe(1);
    expect(result.sales).toBe(2);
    expect(result.revenue).toBe(2700);
  });

  it("simulates postscreening with one submitted price per day", () => {
    const draws: Draw[] = [
      { customerId: "L1", valuationAmount: 800, segment: "LOW", drawOrder: 1, periodNumber: 1 },
      { customerId: "H1", valuationAmount: 1800, segment: "HIGH", drawOrder: 2, periodNumber: 2 }
    ];
    const [result] = simulatePostscreening(draws, [team({ priceUsed: 900, periodNumber: 1 }), team({ priceUsed: 1700, periodNumber: 2 })], 10);
    expect(result.lowSales).toBe(0);
    expect(result.highSales).toBe(1);
    expect(result.sales).toBe(1);
    expect(result.revenue).toBe(1700);
  });

  it("keeps public scoreboard private", () => {
    const [result] = simulateStatic(
      [{ customerId: "C1", valuationAmount: 1000, segment: "UNKNOWN", drawOrder: 1 }],
      [team({ priceUsed: 500 })],
      10
    );
    const publicRows = serializePublicScoreboard([result], false);
    const json = JSON.stringify(publicRows);
    expect(json).not.toContain("valuationAmount");
    expect(json).not.toContain("code");
    expect(publicRows[0].priceUsed).toBeNull();
  });

  it("serializes arbitrary team counts without fixed-size assumptions", () => {
    const decisions = Array.from({ length: 17 }, (_, index) => team({ teamId: `t${index + 1}`, teamNumber: index + 1, teamName: `Team ${index + 1}`, priceUsed: 100 }));
    const results = simulateStatic([{ customerId: "C1", valuationAmount: 200, segment: "UNKNOWN", drawOrder: 1 }], decisions, 20);
    expect(serializePublicScoreboard(results, false)).toHaveLength(17);
  });
});
