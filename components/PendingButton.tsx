"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function PendingButton({ children, pendingText = "Working...", disabled = false }: { children: ReactNode; pendingText?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || pending}>
      {pending ? pendingText : children}
    </button>
  );
}
