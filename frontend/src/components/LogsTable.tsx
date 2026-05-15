import { FilterX, ScrollText } from "lucide-react";
import type { LogEntry, LogLevel, Service } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

const LEVELS: Array<LogLevel | "all"> = ["all", "info", "warning", "error", "critical"];

export function LogsTable({
  logs,
  services,
  selectedService,
  selectedLevel,
  onServiceChange,
  onLevelChange,
  isLoading = false,
  error,
}: {
  logs: LogEntry[];
  services: Service[];
  selectedService: string;
  selectedLevel: LogLevel | "all";
  onServiceChange: (service: string) => void;
  onLevelChange: (level: LogLevel | "all") => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  const hasActiveFilters = selectedService !== "all" || selectedLevel !== "all";

  return (
    <Panel
      title="Logs"
      description="Synthetic application, dependency, and network event logs."
      icon={ScrollText}
      aside={<span className="text-sm text-zinc-500">{logs.length} visible</span>}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-zinc-400">
            <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Service</span>
            <select
              value={selectedService}
              onChange={(event) => onServiceChange(event.target.value)}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
            >
              <option value="all">all services</option>
              {services.map((service) => (
                <option key={service.name} value={service.name}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-400">
            <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Severity</span>
            <select
              value={selectedLevel}
              onChange={(event) => onLevelChange(event.target.value as LogLevel | "all")}
              className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              onServiceChange("all");
              onLevelChange("all");
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            <FilterX className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading logs..." /> : null}
      {!isLoading && !error && logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasActiveFilters ? "No logs match these filters" : "No logs available"}
          description={
            hasActiveFilters
              ? "Clear filters or run another scenario to generate matching log events."
              : "Start the backend or run a simulation scenario to populate the log stream."
          }
        />
      ) : null}

      {!isLoading && !error && logs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="max-h-[440px] overflow-auto">
            <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
              <thead className="sticky top-0 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Trace ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 bg-zinc-950/60">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-zinc-900/60">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-200">{log.service_name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge value={log.level} type="level" />
                    </td>
                    <td className="min-w-[320px] px-4 py-3 leading-6 text-zinc-300">{log.message}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">{log.trace_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
