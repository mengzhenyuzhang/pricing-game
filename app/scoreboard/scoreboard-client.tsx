"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = {
  rank: number | null;
  teamName: string;
  teamNumber: number;
  sales: number;
  lowSales: number;
  highSales: number;
  revenue: number;
  capacityUsed: number;
};

type PriceRow = {
  priceUsed: number | null;
  lowPriceUsed: number | null;
  highPriceUsed: number | null;
  bookingLimitUsed: number | null;
  team: { teamNumber: number } | null;
};

type HistogramBucket = {
  bucket: string;
  count: number;
};

type RunInfo = {
  id: string;
  name: string;
  status: string;
  type: string;
  revealPrices: boolean;
  revealValuationHistogram: boolean;
  currentDrawOrder: number;
};

type RunScoreboard = {
  run: RunInfo;
  results: Row[];
  prices: PriceRow[];
  valuationHistogram: HistogramBucket[];
};

export function ScoreboardClient() {
  const [data, setData] = useState<{ run: RunInfo | null; results: Row[]; prices: PriceRow[]; valuationHistogram: HistogramBucket[]; runs: RunScoreboard[] }>({ run: null, results: [], prices: [], valuationHistogram: [], runs: [] });
  const [large, setLarge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/scoreboard", { cache: "no-store" });
        if (!response.ok) throw new Error("Scoreboard is temporarily unavailable.");
        const payload = await response.json();
        if (active) {
          setData(normalizeScoreboardPayload(payload));
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Scoreboard is temporarily unavailable.");
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!data.run) return <div className="panel p-8 text-center text-2xl font-bold">No simulated scoreboard is available yet.</div>;
  const runs = (data.runs.length ? data.runs : [{ run: data.run, results: data.results, prices: data.prices, valuationHistogram: data.valuationHistogram }])
    .filter((runData): runData is RunScoreboard => Boolean(runData.run));
  return (
    <div className={large ? "space-y-5 text-xl" : "space-y-5"}>
      {error ? <div className="rounded-md bg-red-50 p-3 font-semibold text-red-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black">Scoreboard</h1>
          <p className="font-semibold text-slate-600">Refreshes every 5 seconds</p>
        </div>
        <button className="btn-secondary" onClick={() => setLarge((value) => !value)}>{large ? "Standard display" : "Large display"}</button>
      </div>
      {runs.map((runData) => <RunPanel key={runData.run.id} data={runData} />)}
    </div>
  );
}

function RunPanel({ data }: { data: RunScoreboard }) {
  const chartData = useMemo(() => data.results.map((row) => ({ team: `T${row.teamNumber}`, revenue: row.revenue })), [data.results]);
  const pricesByTeam = useMemo(() => {
    const entries = data.prices.flatMap((price) => price.team ? [[price.team.teamNumber, price] as const] : []);
    return new Map(entries);
  }, [data.prices]);
  const run = data.run;

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black">{run.name}</h2>
          <p className="font-semibold text-slate-600">{run.type} · {run.status} · through day {run.currentDrawOrder}</p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#12355b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {run.revealValuationHistogram ? (
        <div>
          <div className="mb-3">
            <h3 className="text-2xl font-black">Arrival Valuation Histogram</h3>
            <p className="text-sm font-semibold text-slate-600">Buckets adjust to this run&apos;s arrival customer valuations.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.valuationHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef8354" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-slate-100 text-left text-sm uppercase text-slate-600">
            <tr>
              <th className="p-3">Rank</th>
              <th className="p-3">Team</th>
              <th className="p-3 text-right">Sales</th>
              <th className="p-3 text-right">Revenue</th>
              <th className="p-3 text-right">Capacity Used</th>
              {run.type === "POSTSCREENING" ? <th className="p-3 text-right">Low / High</th> : null}
              {run.revealPrices ? <th className="p-3 text-right">Decision</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.results.map((row) => {
              const price = pricesByTeam.get(row.teamNumber);
              return (
                <tr key={row.teamNumber} className="border-t border-slate-200">
                  <td className="p-3 text-3xl font-black text-coral">{row.rank ?? "-"}</td>
                  <td className="p-3 font-bold">{row.teamName}</td>
                  <td className="p-3 text-right font-bold">{row.sales}</td>
                  <td className="p-3 text-right text-2xl font-black">${row.revenue.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.capacityUsed}</td>
                  {run.type === "POSTSCREENING" ? <td className="p-3 text-right">{row.lowSales} / {row.highSales}</td> : null}
                  {run.revealPrices ? (
                    <td className="p-3 text-right">
                      ${price?.priceUsed ?? "-"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizeScoreboardPayload(payload: Partial<{ run: RunInfo | null; results: Row[]; prices: PriceRow[]; valuationHistogram: HistogramBucket[]; runs: RunScoreboard[] }>) {
  return {
    run: normalizeRun(payload.run),
    results: normalizeRows(payload.results),
    prices: normalizePrices(payload.prices),
    valuationHistogram: normalizeHistogram(payload.valuationHistogram),
    runs: Array.isArray(payload.runs)
      ? payload.runs.map((runData) => ({
          run: normalizeRun(runData.run),
          results: normalizeRows(runData.results),
          prices: normalizePrices(runData.prices),
          valuationHistogram: normalizeHistogram(runData.valuationHistogram)
        })).filter((runData): runData is RunScoreboard => Boolean(runData.run))
      : []
  };
}

function normalizeRun(run: RunInfo | null | undefined) {
  if (!run?.id) return null;
  return {
    id: String(run.id),
    name: String(run.name ?? "Run"),
    status: String(run.status ?? ""),
    type: String(run.type ?? ""),
    revealPrices: Boolean(run.revealPrices),
    revealValuationHistogram: Boolean(run.revealValuationHistogram),
    currentDrawOrder: toNumber(run.currentDrawOrder)
  };
}

function normalizeRows(rows: Row[] | undefined) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    rank: row.rank == null ? null : toNumber(row.rank),
    teamName: String(row.teamName ?? "Team"),
    teamNumber: toNumber(row.teamNumber),
    sales: toNumber(row.sales),
    lowSales: toNumber(row.lowSales),
    highSales: toNumber(row.highSales),
    revenue: toNumber(row.revenue),
    capacityUsed: toNumber(row.capacityUsed)
  }));
}

function normalizePrices(prices: PriceRow[] | undefined) {
  if (!Array.isArray(prices)) return [];
  return prices.map((price) => ({
    priceUsed: price.priceUsed == null ? null : toNumber(price.priceUsed),
    lowPriceUsed: price.lowPriceUsed == null ? null : toNumber(price.lowPriceUsed),
    highPriceUsed: price.highPriceUsed == null ? null : toNumber(price.highPriceUsed),
    bookingLimitUsed: price.bookingLimitUsed == null ? null : toNumber(price.bookingLimitUsed),
    team: price.team ? { teamNumber: toNumber(price.team.teamNumber) } : null
  }));
}

function normalizeHistogram(histogram: HistogramBucket[] | undefined) {
  if (!Array.isArray(histogram)) return [];
  return histogram.map((bucket) => ({
    bucket: String(bucket.bucket ?? ""),
    count: toNumber(bucket.count)
  }));
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
