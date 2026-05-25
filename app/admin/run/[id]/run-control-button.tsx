"use client";

import { useState } from "react";

export function RunControlButton({ runId, action, periodId, label, disabled = false, pendingText }: { runId: string; action: string; periodId?: string; label: string; disabled?: boolean; pendingText?: string }) {
  const [busy, setBusy] = useState(false);

  async function click() {
    if (disabled || busy) return;
    setBusy(true);
    let message = "Action complete.";
    try {
      const response = await fetch("/api/admin/run-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, action, periodId: periodId ?? null })
      });
      const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
      message = response.ok ? data.message ?? message : data.error ?? "Action failed.";
    } catch {
      message = "Action failed. Please try again.";
    } finally {
      setBusy(false);
      window.location.assign(`/admin/run/${runId}?message=${encodeURIComponent(message)}`);
    }
  }

  return (
    <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || busy} onClick={click}>
      {busy ? pendingText ?? "Working..." : label}
    </button>
  );
}
