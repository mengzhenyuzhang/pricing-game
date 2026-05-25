export type Segment = "LOW" | "HIGH" | "UNKNOWN";
export type RunType = "STATIC" | "DYNAMIC" | "POSTSCREENING";

export type Draw = {
  customerId: string;
  valuationAmount: number;
  segment: Segment;
  drawOrder: number;
  periodNumber?: number | null;
};

export type Decision = {
  teamId: string;
  teamNumber: number;
  teamName: string;
  priceUsed?: number | null;
  lowPriceUsed?: number | null;
  highPriceUsed?: number | null;
  bookingLimitUsed?: number | null;
  periodNumber?: number | null;
  submittedAt?: Date | string | null;
};

export type SimulationEvent = {
  drawOrder: number;
  customerId: string;
  segment: Segment;
  periodNumber?: number | null;
  priceApplied?: number | null;
  accepted: boolean;
  revenueAdded: number;
  capacityUsedAfter: number;
  valuationAmount?: number;
};

export type SimulationResult = {
  teamId: string;
  teamNumber: number;
  teamName: string;
  sales: number;
  lowSales: number;
  highSales: number;
  revenue: number;
  capacityUsed: number;
  rank: number;
  priceUsed?: number | null;
  lowPriceUsed?: number | null;
  highPriceUsed?: number | null;
  bookingLimitUsed?: number | null;
  events: SimulationEvent[];
};
