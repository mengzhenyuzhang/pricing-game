"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Histogram({ values }: { values: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i + 1}`, count: 0 }));
  for (const value of values) buckets[Math.min(9, Math.floor(value / 1000))].count += 1;
  return (
    <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets}><XAxis dataKey="bucket" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#e86f51" /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}
