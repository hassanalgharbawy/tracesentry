import { AlertTriangle, Clock3 } from "lucide-react";
import type { Incident } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

export function IncidentTimeline({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  isLoading = false,
  error,
}: {
  incidents: Incident[];
  selectedIncidentId?: string;
  onSelectIncident: (incidentId: string) => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <Panel
      title="Incident Timeline"
      description="Generated incidents ordered by newest first."
      icon={AlertTriangle}
      aside={<span className="text-sm text-zinc-500">{incidents.length} total</span>}
    >
      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading incidents..." /> : null}
      {!isLoading && !error && incidents.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No incidents generated"
          description="Run a simulation scenario to create an incident and inspect the RCA panel."
        />
      ) : null}
      {!isLoading && !error && incidents.length > 0 ? (
        <div className="relative space-y-3 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-800">
          {incidents.map((incident) => {
            const selected = selectedIncidentId === incident.id;
            return (
              <button
                key={incident.id}
                type="button"
                onClick={() => onSelectIncident(incident.id)}
                className={`relative w-full rounded-lg border p-4 pl-10 text-left transition ${
                  selected
                    ? "border-cyan-500/60 bg-cyan-500/10"
                    : "border-zinc-800 bg-zinc-900/65 hover:border-zinc-600"
                }`}
              >
                <span
                  className={`absolute left-[7px] top-5 h-3 w-3 rounded-full border ${
                    selected ? "border-cyan-300 bg-cyan-300" : "border-zinc-600 bg-zinc-950"
                  }`}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{incident.root_cause}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(incident.started_at).toLocaleString()} / {incident.affected_service}
                    </p>
                  </div>
                  <StatusBadge value={incident.severity} type="severity" />
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">{incident.explanation}</p>
              </button>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
