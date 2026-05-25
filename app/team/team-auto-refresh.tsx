"use client";

import { useEffect, useRef } from "react";

export function TeamAutoRefresh({ initialSignature }: { initialSignature: string }) {
  const signatureRef = useRef(initialSignature);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const response = await fetch("/api/team-state", { cache: "no-store" });
      if (!active) return;
      if (response.status === 401) {
        window.location.assign("/join");
        return;
      }
      const state = await response.json() as { redirectTo?: string; signature?: string };
      if (state.redirectTo && state.redirectTo !== "/team") {
        window.location.assign(state.redirectTo);
        return;
      }
      if (state.signature && state.signature !== signatureRef.current) {
        signatureRef.current = state.signature;
        window.location.reload();
      }
    };

    poll();
    const timer = window.setInterval(poll, 2500);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
