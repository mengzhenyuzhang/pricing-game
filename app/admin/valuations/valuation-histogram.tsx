"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildAdaptiveHistogram } from "@/lib/histogram";

export function Histogram({ values }: { values: number[] }) {
  const buckets = buildAdaptiveHistogram(values);
  return (
    <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets}><XAxis dataKey="bucket" interval={0} angle={-25} textAnchor="end" height={70} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#e86f51" /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}
