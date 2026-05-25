"use client";

import { useState } from "react";

export function TeamDecisionForm({ runType }: { runType: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/team-submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? `Submission received at ${new Date(data.submittedAt).toLocaleTimeString()}.` : data.error);
  }

  return (
    <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      {runType === "POSTSCREENING" ? (
        <>
          <label><span className="label">Low price</span><input className="input mt-1" name="lowPrice" inputMode="numeric" required /></label>
          <label><span className="label">High price</span><input className="input mt-1" name="highPrice" inputMode="numeric" required /></label>
          <label><span className="label">Low booking limit</span><input className="input mt-1" name="bookingLimit" inputMode="numeric" required /></label>
        </>
      ) : (
        <label><span className="label">Price</span><input className="input mt-1" name="price" inputMode="numeric" required /></label>
      )}
      <div className="sm:col-span-2">
        <button disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? "Submitting..." : "Submit team decision"}</button>
        {message ? <p className="mt-4 rounded-md bg-mint p-3 font-semibold">{message}</p> : null}
      </div>
    </form>
  );
}
