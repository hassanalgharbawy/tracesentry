from pydantic import BaseModel, Field

from app.models import IncidentSeverity, LogLevel, ServiceStatus


class Service(BaseModel):
    name: str
    status: ServiceStatus
    latency_ms: float
    error_rate: float
    throughput_rpm: int
    dependencies: list[str]
    last_seen: str


class Metric(BaseModel):
    id: int
    service_name: str
    timestamp: str
    latency_ms: float
    error_rate: float
    throughput_rpm: int


class LogEntry(BaseModel):
    id: int
    timestamp: str
    service_name: str
    level: LogLevel
    message: str
    trace_id: str


class AnomalyScore(BaseModel):
    latency_z: float
    error_z: float
    throughput_z: float
    score: float


class RootCauseAnalysis(BaseModel):
    likely_root_cause: str
    explanation: str
    affected_downstream_services: list[str]
    suggested_fix: str
    runbook_steps: list[str]
    anomaly_scores: dict[str, AnomalyScore] = Field(default_factory=dict)


class Incident(BaseModel):
    id: str
    severity: IncidentSeverity
    affected_service: str
    started_at: str
    status: str
    scenario: str
    root_cause: str
    suggested_fix: str
    explanation: str
    affected_downstream_services: list[str]


class IncidentDetail(Incident):
    analysis: RootCauseAnalysis
    related_logs: list[LogEntry]


class SimulationResponse(BaseModel):
    scenario: str
    incident: IncidentDetail
    services: list[Service]
    message: str


class HealthResponse(BaseModel):
    status: str
    service_count: int
    active_incidents: int
    database: str
