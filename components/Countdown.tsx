"use client";

import { useEffect, useState } from "react";

export function Countdown({ deadline }: { deadline?: string | null }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const remaining = new Date(deadline).getTime() - Date.now();
      if (remaining <= 0) {
        setText("Deadline passed");
        return;
      }
      const seconds = Math.floor(remaining / 1000);
      setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return <span className="rounded-md bg-gold/20 px-3 py-1 text-sm font-bold text-slate-900">{text}</span>;
}
