"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LobbyClient({ displayName, attendanceMode, sessionName }: { displayName: string; attendanceMode: string; sessionName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("Waiting for instructor to assign teams");
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (data.redirectTo === "/team") router.replace("/team");
        else setStatus("Waiting for instructor to assign teams");
      } catch {
        setStatus("Still checked in. Reconnecting to the classroom session...");
      }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [router]);
  return (
    <div className="mx-auto max-w-2xl text-center">
      <section className="panel p-8">
        <p className="text-sm font-bold uppercase tracking-wide text-coral">{sessionName}</p>
        <h1 className="mt-3 text-4xl font-black">You are checked in</h1>
        <p className="mt-4 text-2xl font-bold">{displayName}</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{attendanceMode === "ONLINE" ? "Online" : "In person"}</p>
        <p className="mt-2 text-sm text-slate-500">Testing as another student? Use a separate browser profile/incognito window, or <a className="font-bold text-coral underline" href="/api/logout">switch student</a>.</p>
        <p className="mt-6 rounded-md bg-mint p-4 text-lg font-semibold">{status}</p>
        <div className="mx-auto mt-6 h-3 w-48 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-coral" /></div>
      </section>
    </div>
  );
}
