export type ServiceStatus = "healthy" | "degraded" | "down";
export type LogLevel = "info" | "warning" | "error" | "critical";
export type Severity = "low" | "medium" | "high" | "critical";

export interface Service {
  name: string;
  status: ServiceStatus;
  latency_ms: number;
  error_rate: number;
  throughput_rpm: number;
  dependencies: string[];
  last_seen: string;
}

export interface Metric {
  id: number;
  service_name: string;
  timestamp: string;
  latency_ms: number;
  error_rate: number;
  throughput_rpm: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  service_name: string;
  level: LogLevel;
  message: string;
  trace_id: string;
}

export interface RootCauseAnalysis {
  likely_root_cause: string;
  explanation: string;
  affected_downstream_services: string[];
  suggested_fix: string;
  runbook_steps: string[];
  anomaly_scores: Record<
    string,
    {
      latency_z: number;
      error_z: number;
      throughput_z: number;
      score: number;
    }
  >;
}

export interface Incident {
  id: string;
  severity: Severity;
  affected_service: string;
  started_at: string;
  status: string;
  scenario: string;
  root_cause: string;
  suggested_fix: string;
  explanation: string;
  affected_downstream_services: string[];
}

export interface IncidentDetail extends Incident {
  analysis: RootCauseAnalysis;
  related_logs: LogEntry[];
}

export interface SimulationResponse {
  scenario: string;
  incident: IncidentDetail;
  services: Service[];
  message: string;
}

export type Scenario =
  | "database_latency"
  | "auth_failure"
  | "payment_timeout"
  | "api_gateway_spike"
  | "network_packet_loss";
