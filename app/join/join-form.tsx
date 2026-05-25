"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinForm({ code, sessionName }: { code: string; sessionName: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(formData), classSessionCode: code })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) setMessage(data.error);
    else router.replace(data.redirectTo);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-coral">{sessionName}</p>
        <h1 className="mt-2 text-4xl font-black">Welcome to the Pricing Game</h1>
        <p className="mt-4 text-slate-700">Enter your name and your maximum willingness to pay for the cruise package.</p>
        <p className="mt-4 rounded-md bg-mint p-3 text-slate-800">Imagine a five-day all-inclusive luxury cruise package for two people. Airfare is not included. Assume it is at a time that works for you, under ideal conditions. What is the maximum total amount you personally would be willing to pay?</p>
        <form action={submit} className="mt-6 space-y-4">
          <label className="block"><span className="label">Name</span><input className="input mt-1 text-lg" name="displayName" required autoComplete="name" /></label>
          <label className="block"><span className="label">Email optional</span><input className="input mt-1 text-lg" name="email" type="email" autoComplete="email" /></label>
          <label className="block"><span className="label">Maximum willingness to pay</span><input className="input mt-1 text-lg" name="valuationAmount" required inputMode="numeric" placeholder="2500" /></label>
          <fieldset className="space-y-2">
            <legend className="label">How are you attending today?</legend>
            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-lg font-semibold">
              <input type="radio" name="attendanceMode" value="IN_PERSON" required />
              In person
            </label>
            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-lg font-semibold">
              <input type="radio" name="attendanceMode" value="ONLINE" required />
              Online
            </label>
          </fieldset>
          <button disabled={busy} className="btn-primary w-full text-lg">{busy ? "Checking in..." : "Check in"}</button>
        </form>
        {message ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-700">{message}</p> : null}
      </section>
    </div>
  );
}
