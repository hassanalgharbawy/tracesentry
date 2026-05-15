import { Activity, Database, Server } from "lucide-react";
import type { Service } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

const STATUS_ACCENT = {
  healthy: "border-l-emerald-400",
  degraded: "border-l-amber-400",
  down: "border-l-red-400",
} as const;

export function ServiceHealthCards({
  services,
  isLoading = false,
  error,
}: {
  services: Service[];
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <Panel
      title="Service Health"
      description="Current status, latency, error rate, throughput, and upstream dependencies."
      icon={Server}
    >
      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading service health..." /> : null}
      {!isLoading && !error ? (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={Server}
              title="No service telemetry"
              description="Start the backend API to load seeded service health data."
            />
          </div>
        ) : (
          services.map((service) => (
            <article
              key={service.name}
              className={`rounded-lg border border-l-4 border-zinc-800 bg-zinc-900/65 p-4 ${STATUS_ACCENT[service.status]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-zinc-50">{service.name}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    last seen {new Date(service.last_seen).toLocaleTimeString()}
                  </p>
                </div>
                <StatusBadge value={service.status} type="status" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-zinc-800 bg-zinc-950/55 p-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Latency</p>
                  <p className="mt-1 font-semibold text-zinc-100">{service.latency_ms.toFixed(0)} ms</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Errors</p>
                  <p className="mt-1 font-semibold text-zinc-100">{formatPercent(service.error_rate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">RPM</p>
                  <p className="mt-1 font-semibold text-zinc-100">{service.throughput_rpm}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Dependencies</p>
                <div className="flex min-h-8 flex-wrap gap-2">
                  {service.dependencies.length === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                      <Activity className="h-3 w-3" aria-hidden="true" />
                      none
                    </span>
                  ) : (
                    service.dependencies.map((dependency) => (
                      <span
                        key={dependency}
                        className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-950/50 px-2 py-1 text-xs text-zinc-300"
                      >
                        <Database className="h-3 w-3" aria-hidden="true" />
                        {dependency}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      ) : null}
    </Panel>
  );
}
