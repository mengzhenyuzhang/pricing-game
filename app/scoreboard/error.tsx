"use client";

export default function ScoreboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <section className="panel p-6 text-center">
        <h1 className="text-3xl font-black">Scoreboard needs a refresh</h1>
        <p className="mt-3 rounded-md bg-red-50 p-3 font-semibold text-red-700">{error.message || "The scoreboard could not render this state."}</p>
        <button className="btn-primary mt-5" onClick={reset}>Try again</button>
      </section>
    </div>
  );
}
