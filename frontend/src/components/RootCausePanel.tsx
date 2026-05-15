import { GitBranch, ListChecks, SearchCheck, ShieldCheck, Wrench } from "lucide-react";
import type { IncidentDetail } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";

export function RootCausePanel({
  incident,
  isLoading = false,
  error,
}: {
  incident?: IncidentDetail;
  isLoading?: boolean;
  error?: string | null;
}) {
  const anomalyRows = incident
    ? Object.entries(incident.analysis.anomaly_scores)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 4)
    : [];

  return (
    <Panel
      title="Root Cause Analysis"
      description="Rule-based diagnosis with dependency impact and runbook guidance."
      icon={ShieldCheck}
    >
      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading incident analysis..." /> : null}
      {!isLoading && !error && !incident ? (
        <EmptyState
          icon={SearchCheck}
          title="Select an incident"
          description="The RCA panel will show likely root cause, affected services, explanation, and suggested fix."
        />
      ) : null}

      {!isLoading && !error && incident ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">Likely root cause</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-zinc-50">
              {incident.analysis.likely_root_cause}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{incident.analysis.explanation}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-4">
              <div className="mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <h3 className="text-sm font-medium text-zinc-200">Affected Services</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {incident.analysis.affected_downstream_services.length === 0 ? (
                  <span className="text-sm text-zinc-500">No downstream impact detected.</span>
                ) : (
                  incident.analysis.affected_downstream_services.map((service) => (
                    <span
                      key={service}
                      className="rounded border border-zinc-700 bg-zinc-950/50 px-2 py-1 text-xs text-zinc-300"
                    >
                      {service}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-lime-300" aria-hidden="true" />
                <h3 className="text-sm font-medium text-zinc-200">Suggested Fix</h3>
              </div>
              <p className="text-sm leading-6 text-zinc-400">{incident.analysis.suggested_fix}</p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-lime-300" aria-hidden="true" />
              <h3 className="text-sm font-medium text-zinc-200">Runbook Steps</h3>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-400">
              {incident.analysis.runbook_steps.map((step) => (
                <li key={step} className="leading-6">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-4">
            <h3 className="text-sm font-medium text-zinc-200">Top Anomaly Scores</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {anomalyRows.map(([service, score]) => (
                <div key={service} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-300">{service}</span>
                    <span className="font-mono text-sm font-semibold text-cyan-300">{score.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    latency z {score.latency_z} / error z {score.error_z} / throughput z {score.throughput_z}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
