export function StatusBadge({ status }: { status?: string }) {
  const label = status ? status[0] + status.slice(1).toLowerCase() : "Not open";
  const colors: Record<string, string> = {
    OPEN: "bg-emerald-100 text-emerald-800",
    LOCKED: "bg-amber-100 text-amber-800",
    SIMULATED: "bg-sky-100 text-sky-800",
    REVEALED: "bg-navy text-white",
    DRAFT: "bg-slate-100 text-slate-700"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors[status ?? ""] ?? colors.DRAFT}`}>{label}</span>;
}
