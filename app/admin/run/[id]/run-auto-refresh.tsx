"use client";

import { useEffect, useRef } from "react";

export function RunAutoRefresh({ runId, initialSignature }: { runId: string; initialSignature: string }) {
  const signatureRef = useRef(initialSignature);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const response = await fetch(`/api/admin/run-state/${runId}`, { cache: "no-store" });
      if (!active || !response.ok) return;
      const state = await response.json() as { signature?: string };
      if (state.signature && state.signature !== signatureRef.current) {
        signatureRef.current = state.signature;
        window.location.reload();
      }
    };

    const timer = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [runId]);

  return null;
}
