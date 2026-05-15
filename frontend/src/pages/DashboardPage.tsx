import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  Network,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Signal,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DependencyMap } from "../components/DependencyMap";
import { ErrorNotice } from "../components/ErrorNotice";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { LogsTable } from "../components/LogsTable";
import { MetricsCharts } from "../components/MetricsCharts";
import { RootCausePanel } from "../components/RootCausePanel";
import { ServiceHealthCards } from "../components/ServiceHealthCards";
import { StatCard } from "../components/StatCard";
import type { Incident, IncidentDetail, LogEntry, LogLevel, Metric, Scenario, Service } from "../types";

const SCENARIOS: Array<{
  id: Scenario;
  label: string;
  icon: typeof Database;
  title: string;
}> = [
  { id: "database_latency", label: "Database Latency", icon: Database, title: "Simulate database bottleneck" },
  { id: "auth_failure", label: "Auth Failure", icon: ShieldAlert, title: "Simulate authentication failures" },
  { id: "payment_timeout", label: "Payment Timeout", icon: Zap, title: "Simulate payment timeouts" },
  { id: "api_gateway_spike", label: "Gateway Spike", icon: Signal, title: "Simulate traffic spike" },
  { id: "network_packet_loss", label: "Packet Loss", icon: Network, title: "Simulate packet loss" },
];

function percentage(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function DashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | undefined>();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | undefined>();
  const [metricService, setMetricService] = useState("api-gateway");
  const [logService, setLogService] = useState("all");
  const [logLevel, setLogLevel] = useState<LogLevel | "all">("all");

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState<Scenario | "reset" | null>(null);

  const [pageError, setPageError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const loadBaseData = useCallback(async (preferredIncidentId?: string) => {
    setPageError(null);
    setIncidentError(null);
    const [serviceData, incidentData] = await Promise.all([api.getServices(), api.getIncidents()]);
    setServices(serviceData);
    setIncidents(incidentData);

    const candidateId = preferredIncidentId ?? incidentData[0]?.id;
    const incidentToLoad = incidentData.some((incident) => incident.id === candidateId) ? candidateId : incidentData[0]?.id;
    setSelectedIncidentId(incidentToLoad);
    if (incidentToLoad) {
      const detail = await api.getIncident(incidentToLoad);
      setSelectedIncident(detail);
    } else {
      setSelectedIncident(undefined);
    }
  }, []);

  async function refreshMetrics(serviceName: string) {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      setMetrics(await api.getMetrics(serviceName));
    } catch (error) {
      setMetricsError(toErrorMessage(error, "Failed to load metrics"));
    } finally {
      setMetricsLoading(false);
    }
  }

  async function refreshLogs(serviceName: string, level: LogLevel | "all") {
    setLogsLoading(true);
    setLogsError(null);
    try {
      setLogs(await api.getLogs({ service: serviceName, level, limit: 160 }));
    } catch (error) {
      setLogsError(toErrorMessage(error, "Failed to load logs"));
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setIsBootstrapping(true);
        await loadBaseData();
      } catch (error) {
        setPageError(toErrorMessage(error, "Failed to load TraceSentry data"));
      } finally {
        setIsBootstrapping(false);
      }
    }
    bootstrap();
  }, [loadBaseData]);

  useEffect(() => {
    let isActive = true;
    api
      .getMetrics(metricService)
      .then((data) => {
        if (!isActive) return;
        setMetrics(data);
        setMetricsError(null);
      })
      .catch((error) => {
        if (!isActive) return;
        setMetricsError(toErrorMessage(error, "Failed to load metrics"));
      })
      .finally(() => {
        if (isActive) setMetricsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [metricService]);

  useEffect(() => {
    let isActive = true;
    api
      .getLogs({ service: logService, level: logLevel, limit: 160 })
      .then((data) => {
        if (!isActive) return;
        setLogs(data);
        setLogsError(null);
      })
      .catch((error) => {
        if (!isActive) return;
        setLogsError(toErrorMessage(error, "Failed to load logs"));
      })
      .finally(() => {
        if (isActive) setLogsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [logLevel, logService]);

  const summary = useMemo(() => {
    const downCount = services.filter((service) => service.status === "down").length;
    const degradedCount = services.filter((service) => service.status === "degraded").length;
    const status = downCount > 0 ? "critical" : degradedCount > 0 ? "degraded" : "healthy";
    const avgLatency = average(services.map((service) => service.latency_ms));
    const avgErrorRate = average(services.map((service) => service.error_rate));
    const throughput = services.reduce((sum, service) => sum + service.throughput_rpm, 0);

    return {
      status,
      avgLatency,
      avgErrorRate,
      throughput,
      activeIncidents: incidents.filter((incident) => incident.status === "active").length,
      degradedCount,
      downCount,
    };
  }, [incidents, services]);

  async function runScenario(scenario: Scenario) {
    try {
      setIsSimulating(scenario);
      setPageError(null);
      setIncidentError(null);
      const response = await api.simulate(scenario);
      setSelectedIncidentId(response.incident.id);
      setSelectedIncident(response.incident);
      await Promise.all([
        loadBaseData(response.incident.id),
        refreshMetrics(metricService),
        refreshLogs(logService, logLevel),
      ]);
    } catch (error) {
      setPageError(toErrorMessage(error, "Simulation failed"));
    } finally {
      setIsSimulating(null);
    }
  }

  async function reset() {
    try {
      setIsSimulating("reset");
      setPageError(null);
      setIncidentError(null);
      await api.reset();
      setSelectedIncidentId(undefined);
      setSelectedIncident(undefined);
      await Promise.all([loadBaseData(), refreshMetrics(metricService), refreshLogs(logService, logLevel)]);
    } catch (error) {
      setPageError(toErrorMessage(error, "Reset failed"));
    } finally {
      setIsSimulating(null);
    }
  }

  async function selectIncident(incidentId: string) {
    try {
      setIncidentLoading(true);
      setIncidentError(null);
      setSelectedIncidentId(incidentId);
      setSelectedIncident(await api.getIncident(incidentId));
    } catch (error) {
      setIncidentError(toErrorMessage(error, "Failed to load incident"));
    } finally {
      setIncidentLoading(false);
    }
  }

  const statusTone = summary.status === "healthy" ? "good" : summary.status === "degraded" ? "warn" : "bad";

  function handleMetricServiceChange(serviceName: string) {
    setMetricsLoading(true);
    setMetricService(serviceName);
  }

  function handleLogServiceChange(serviceName: string) {
    setLogsLoading(true);
    setLogService(serviceName);
  }

  function handleLogLevelChange(level: LogLevel | "all") {
    setLogsLoading(true);
    setLogLevel(level);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950/90 p-5 shadow-panel">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-zinc-50">TraceSentry</h1>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Local incident simulator for distributed-service health, logs, metrics, and RCA.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((scenario) => {
                const Icon = scenario.icon;
                const active = isSimulating === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    title={scenario.title}
                    aria-busy={active}
                    disabled={Boolean(isSimulating)}
                    onClick={() => runScenario(scenario.id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-cyan-500/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {active ? (
                      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    )}
                    {active ? "Running" : scenario.label}
                  </button>
                );
              })}
              <button
                type="button"
                title="Reset seeded baseline"
                disabled={Boolean(isSimulating)}
                onClick={reset}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>

          {pageError ? <div className="mt-4"><ErrorNotice message={pageError} /></div> : null}
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="System Status"
            value={summary.status}
            detail={`${summary.degradedCount} degraded / ${summary.downCount} down`}
            icon={AlertTriangle}
            tone={statusTone}
          />
          <StatCard
            label="Active Incidents"
            value={String(summary.activeIncidents)}
            detail="Generated by simulation scenarios"
            icon={ShieldAlert}
            tone={summary.activeIncidents > 0 ? "warn" : "good"}
          />
          <StatCard
            label="Average Latency"
            value={`${summary.avgLatency.toFixed(0)} ms`}
            detail="Across all simulated services"
            icon={Gauge}
            tone={summary.avgLatency > 250 ? "bad" : summary.avgLatency > 120 ? "warn" : "neutral"}
          />
          <StatCard
            label="Error Rate"
            value={percentage(summary.avgErrorRate)}
            detail="Mean application error rate"
            icon={Activity}
            tone={summary.avgErrorRate > 0.08 ? "bad" : summary.avgErrorRate > 0.02 ? "warn" : "neutral"}
          />
          <StatCard
            label="Throughput"
            value={`${summary.throughput}`}
            detail="Total requests per minute"
            icon={Signal}
            tone="neutral"
          />
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
          <ServiceHealthCards services={services} isLoading={isBootstrapping} error={pageError} />
          <IncidentTimeline
            incidents={incidents}
            selectedIncidentId={selectedIncidentId}
            onSelectIncident={selectIncident}
            isLoading={isBootstrapping}
            error={pageError}
          />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <DependencyMap services={services} isLoading={isBootstrapping} error={pageError} />
          <RootCausePanel incident={selectedIncident} isLoading={incidentLoading} error={incidentError} />
        </div>

        <MetricsCharts
          services={services}
          metrics={metrics}
          selectedService={metricService}
          onSelectService={handleMetricServiceChange}
          isLoading={metricsLoading}
          error={metricsError}
        />

        <LogsTable
          logs={logs}
          services={services}
          selectedService={logService}
          selectedLevel={logLevel}
          onServiceChange={handleLogServiceChange}
          onLevelChange={handleLogLevelChange}
          isLoading={logsLoading}
          error={logsError}
        />
      </div>
    </main>
  );
}
