import type { LogLevel, ServiceStatus, Severity } from "../types";

const STATUS_STYLES: Record<ServiceStatus, string> = {
  healthy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  degraded: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  down: "border-red-500/40 bg-red-500/10 text-red-300",
};

const SEVERITY_STYLES: Record<Severity, string> = {
  low: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  error: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
};

export function StatusBadge({
  value,
  type,
}: {
  value: ServiceStatus | Severity | LogLevel;
  type: "status" | "severity" | "level";
}) {
  const styles =
    type === "status"
      ? STATUS_STYLES[value as ServiceStatus]
      : type === "severity"
        ? SEVERITY_STYLES[value as Severity]
        : LEVEL_STYLES[value as LogLevel];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {value}
    </span>
  );
}
