import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const iconStyles = {
    neutral: "border-zinc-700 bg-zinc-900 text-zinc-300",
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    bad: "border-red-500/30 bg-red-500/10 text-red-300",
  }[tone];

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/85 p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-50">{value}</p>
        </div>
        <span className={`rounded-md border p-2 ${iconStyles}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm text-zinc-400">{detail}</p>
    </section>
  );
}
