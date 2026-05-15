from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    fetch_incidents,
    fetch_logs,
    fetch_metrics,
    fetch_services,
    get_connection,
    incident_row_to_dict,
    init_db,
)
from app.models import SERVICE_NAMES, VALID_SCENARIOS, LogLevel
from app.root_cause import analyze_incident
from app.schemas import (
    HealthResponse,
    Incident,
    IncidentDetail,
    LogEntry,
    Metric,
    Service,
    SimulationResponse,
)
from app.simulator import reset_simulation, simulate_scenario

app = FastAPI(
    title="TraceSentry API",
    description="Local network incident simulator and observability backend.",
    version="1.0.0",
    openapi_tags=[
        {"name": "health", "description": "Backend and seeded-data health checks."},
        {"name": "telemetry", "description": "Service health, metrics, and logs."},
        {"name": "incidents", "description": "Generated incidents and root-cause analysis."},
        {"name": "simulation", "description": "Scenario execution and reset controls."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    init_db()
    with get_connection() as conn:
        service_count = conn.execute("SELECT COUNT(*) AS count FROM services").fetchone()["count"]
        active_incidents = conn.execute(
            "SELECT COUNT(*) AS count FROM incidents WHERE status = 'active'"
        ).fetchone()["count"]
    return HealthResponse(
        status="ok",
        service_count=service_count,
        active_incidents=active_incidents,
        database="sqlite",
    )


@app.get("/api/services", response_model=list[Service], tags=["telemetry"])
def list_services() -> list[Service]:
    init_db()
    with get_connection() as conn:
        return [Service(**service) for service in fetch_services(conn)]


@app.get("/api/metrics", response_model=list[Metric], tags=["telemetry"])
def list_metrics(limit: int = Query(default=360, ge=1, le=2000)) -> list[Metric]:
    init_db()
    with get_connection() as conn:
        return [Metric(**metric) for metric in fetch_metrics(conn, limit=limit)]


@app.get("/api/metrics/{service_name}", response_model=list[Metric], tags=["telemetry"])
def metrics_by_service(service_name: str, limit: int = Query(default=120, ge=1, le=1000)) -> list[Metric]:
    init_db()
    with get_connection() as conn:
        services = {service["name"] for service in fetch_services(conn)}
        if service_name not in services:
            raise HTTPException(status_code=404, detail=f"Service '{service_name}' was not found")
        return [Metric(**metric) for metric in fetch_metrics(conn, service_name=service_name, limit=limit)]


@app.get("/api/logs", response_model=list[LogEntry], tags=["telemetry"])
def list_logs(
    service: str | None = None,
    level: LogLevel | None = None,
    limit: int = Query(default=150, ge=1, le=500),
) -> list[LogEntry]:
    init_db()
    if service and service not in SERVICE_NAMES:
        raise HTTPException(status_code=404, detail=f"Service '{service}' was not found")
    with get_connection() as conn:
        return [LogEntry(**log) for log in fetch_logs(conn, service_name=service, level=level, limit=limit)]


@app.get("/api/incidents", response_model=list[Incident], tags=["incidents"])
def list_incidents() -> list[Incident]:
    init_db()
    with get_connection() as conn:
        return [Incident(**incident) for incident in fetch_incidents(conn)]


@app.get("/api/incidents/{incident_id}", response_model=IncidentDetail, tags=["incidents"])
def incident_detail(incident_id: str) -> IncidentDetail:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' was not found")
        incident = incident_row_to_dict(row)
        analysis = analyze_incident(conn, incident_id)
        if analysis is None:
            raise HTTPException(status_code=500, detail="Incident analysis could not be generated")
        related_logs = fetch_logs(conn, service_name=incident["affected_service"], limit=20)
        if incident["affected_service"] == "network":
            related_logs = fetch_logs(conn, limit=20)
        return IncidentDetail(
            **incident,
            analysis=analysis,
            related_logs=[LogEntry(**log) for log in related_logs],
        )


@app.post("/api/simulate/{scenario}", response_model=SimulationResponse, tags=["simulation"])
def simulate(scenario: str) -> SimulationResponse:
    init_db()
    if scenario not in VALID_SCENARIOS:
        valid = ", ".join(sorted(VALID_SCENARIOS))
        raise HTTPException(status_code=404, detail=f"Unknown scenario '{scenario}'. Valid scenarios: {valid}")
    try:
        return SimulationResponse(**simulate_scenario(scenario))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/reset", tags=["simulation"])
def reset() -> dict[str, str]:
    reset_simulation()
    return {"status": "reset", "message": "TraceSentry returned to healthy seeded baseline data."}
