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
  team: { teamNumber: number };
};

export function ScoreboardClient() {
  const [data, setData] = useState<{ run: null | { name: string; status: string; type: string; revealPrices: boolean }; results: Row[]; prices: PriceRow[] }>({ run: null, results: [], prices: [] });
  const [large, setLarge] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch("/api/scoreboard", { cache: "no-store" });
      if (active) setData(await response.json());
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const chartData = useMemo(() => data.results.map((row) => ({ team: `T${row.teamNumber}`, revenue: row.revenue })), [data.results]);
  const pricesByTeam = useMemo(() => new Map(data.prices.map((price) => [price.team.teamNumber, price])), [data.prices]);

  if (!data.run) return <div className="panel p-8 text-center text-2xl font-bold">No simulated scoreboard is available yet.</div>;
  const run = data.run;
  return (
    <div className={large ? "space-y-5 text-xl" : "space-y-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black">{data.run.name}</h1>
          <p className="font-semibold text-slate-600">Refreshes every 5 seconds</p>
        </div>
        <button className="btn-secondary" onClick={() => setLarge((value) => !value)}>{large ? "Standard display" : "Large display"}</button>
      </div>
      <section className="panel h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#12355b" />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="panel overflow-x-auto">
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
                      {run.type === "POSTSCREENING"
                        ? `L $${price?.lowPriceUsed ?? "-"} / H $${price?.highPriceUsed ?? "-"} / limit ${price?.bookingLimitUsed ?? "-"}`
                        : `$${price?.priceUsed ?? "-"}`}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
