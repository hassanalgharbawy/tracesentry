import json
import random
import uuid
from datetime import datetime, timezone
from typing import Any

from app.database import fetch_services, get_connection
from app.models import VALID_SCENARIOS
from app.root_cause import analyze_incident
from app.seed import BASE_SERVICES, seed_database


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _trace_id() -> str:
    return f"trace-{uuid.uuid4().hex[:12]}"


def _update_service(conn, name: str, **fields: Any) -> None:
    assignments = ", ".join(f"{key} = ?" for key in fields)
    values = list(fields.values())
    conn.execute(f"UPDATE services SET {assignments}, last_seen = ? WHERE name = ?", (*values, utc_now_iso(), name))


def _restore_services_to_baseline(conn) -> None:
    timestamp = utc_now_iso()
    for name, service in BASE_SERVICES.items():
        conn.execute(
            """
            UPDATE services
            SET status = ?, latency_ms = ?, error_rate = ?, throughput_rpm = ?, dependencies = ?, last_seen = ?
            WHERE name = ?
            """,
            (
                service["status"],
                service["latency_ms"],
                service["error_rate"],
                service["throughput_rpm"],
                json.dumps(service["dependencies"]),
                timestamp,
                name,
            ),
        )


def _insert_metric_snapshot(conn) -> None:
    timestamp = utc_now_iso()
    rows = conn.execute("SELECT * FROM services").fetchall()
    for row in rows:
        conn.execute(
            """
            INSERT INTO metrics (service_name, timestamp, latency_ms, error_rate, throughput_rpm)
            VALUES (?, ?, ?, ?, ?)
            """,
            (row["name"], timestamp, row["latency_ms"], row["error_rate"], row["throughput_rpm"]),
        )


def _insert_logs(conn, entries: list[tuple[str, str, str]]) -> None:
    timestamp = utc_now_iso()
    for service_name, level, message in entries:
        conn.execute(
            """
            INSERT INTO logs (timestamp, service_name, level, message, trace_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (timestamp, service_name, level, message, _trace_id()),
        )


def _insert_incident(
    conn,
    *,
    scenario: str,
    severity: str,
    affected_service: str,
    root_cause: str,
    suggested_fix: str,
    explanation: str,
    downstream: list[str],
) -> str:
    incident_id = f"inc-{uuid.uuid4().hex[:8]}"
    conn.execute(
        """
        INSERT INTO incidents
        (id, severity, affected_service, started_at, status, scenario, root_cause, suggested_fix, explanation, affected_downstream_services)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            incident_id,
            severity,
            affected_service,
            utc_now_iso(),
            "active",
            scenario,
            root_cause,
            suggested_fix,
            explanation,
            json.dumps(downstream),
        ),
    )
    return incident_id


def _incident_detail(conn, incident_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    incident = dict(row)
    incident["affected_downstream_services"] = json.loads(incident["affected_downstream_services"])
    logs = conn.execute(
        """
        SELECT * FROM logs
        ORDER BY timestamp DESC, id DESC
        LIMIT 12
        """
    ).fetchall()
    incident["analysis"] = analyze_incident(conn, incident_id)
    incident["related_logs"] = [dict(log) for log in logs]
    return incident


def simulate_scenario(scenario: str) -> dict[str, Any]:
    if scenario not in VALID_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'")

    with get_connection() as conn:
        _restore_services_to_baseline(conn)

        if scenario == "database_latency":
            _update_service(conn, "database", status="degraded", latency_ms=920, error_rate=0.034, throughput_rpm=690)
            _update_service(conn, "user-service", status="degraded", latency_ms=330, error_rate=0.045, throughput_rpm=190)
            _update_service(conn, "payment-service", status="degraded", latency_ms=610, error_rate=0.062, throughput_rpm=112)
            _update_service(conn, "api-gateway", status="degraded", latency_ms=210, error_rate=0.026, throughput_rpm=390)
            _insert_logs(
                conn,
                [
                    ("database", "critical", "Query latency exceeded threshold; connection pool waiting on slow transactions"),
                    ("user-service", "error", "Profile read dependency exceeded timeout while waiting on database"),
                    ("payment-service", "error", "Authorization lookup timed out on database read path"),
                    ("api-gateway", "warning", "Elevated upstream latency from user-service and payment-service"),
                ],
            )
            incident_id = _insert_incident(
                conn,
                scenario=scenario,
                severity="critical",
                affected_service="database",
                root_cause="database bottleneck",
                suggested_fix="Review slow queries, connection pool saturation, and recent schema or migration changes.",
                explanation="Database latency is above baseline and the services with direct database dependencies degraded in the same window.",
                downstream=["api-gateway", "payment-service", "user-service"],
            )

        elif scenario == "auth_failure":
            _update_service(conn, "auth-service", status="down", latency_ms=180, error_rate=0.31, throughput_rpm=210)
            _update_service(conn, "api-gateway", status="degraded", latency_ms=190, error_rate=0.13, throughput_rpm=440)
            _insert_logs(
                conn,
                [
                    ("auth-service", "critical", "Token verification failures exceeded the authentication error budget"),
                    ("auth-service", "error", "Signing-key lookup failed repeatedly during credential validation"),
                    ("api-gateway", "error", "Authentication middleware returned elevated 401 and 503 responses"),
                    ("api-gateway", "warning", "Gateway failure rate increased after auth-service errors"),
                ],
            )
            incident_id = _insert_incident(
                conn,
                scenario=scenario,
                severity="high",
                affected_service="auth-service",
                root_cause="authentication service failure",
                suggested_fix="Check signing-key configuration, token verification dependencies, and unhealthy auth workers.",
                explanation="Auth-service errors are elevated and gateway failures are concentrated on authenticated request paths.",
                downstream=["api-gateway"],
            )

        elif scenario == "payment_timeout":
            _update_service(conn, "payment-service", status="down", latency_ms=2450, error_rate=0.42, throughput_rpm=54)
            _update_service(conn, "api-gateway", status="degraded", latency_ms=260, error_rate=0.047, throughput_rpm=405)
            _update_service(conn, "notification-service", status="degraded", latency_ms=120, error_rate=0.018, throughput_rpm=150)
            _insert_logs(
                conn,
                [
                    ("payment-service", "critical", "Payment authorization timed out after retry budget was exhausted"),
                    ("payment-service", "error", "Checkout authorization hold failed before upstream response completed"),
                    ("api-gateway", "error", "Checkout route exceeded upstream timeout from payment-service"),
                    ("notification-service", "warning", "Receipt delivery delayed while checkout status remained unresolved"),
                ],
            )
            incident_id = _insert_incident(
                conn,
                scenario=scenario,
                severity="critical",
                affected_service="payment-service",
                root_cause="payment service timeout",
                suggested_fix="Queue retries with idempotency keys, inspect timeout budgets, and verify payment worker health.",
                explanation="Payment-service latency and error rate are far outside baseline, and related logs show exhausted timeout budgets.",
                downstream=["api-gateway", "notification-service"],
            )

        elif scenario == "api_gateway_spike":
            _update_service(conn, "api-gateway", status="degraded", latency_ms=310, error_rate=0.032, throughput_rpm=1180)
            _update_service(conn, "auth-service", status="degraded", latency_ms=105, error_rate=0.018, throughput_rpm=610)
            _update_service(conn, "user-service", status="degraded", latency_ms=140, error_rate=0.019, throughput_rpm=430)
            _update_service(conn, "payment-service", status="degraded", latency_ms=230, error_rate=0.025, throughput_rpm=250)
            _update_service(conn, "notification-service", status="degraded", latency_ms=160, error_rate=0.017, throughput_rpm=350)
            _insert_logs(
                conn,
                [
                    ("api-gateway", "critical", "Incoming request rate exceeded normal peak by 2.8x"),
                    ("api-gateway", "warning", "Rate limiter entered protective mode for high-volume clients"),
                    ("auth-service", "warning", "Auth queue depth increased under gateway fan-out"),
                    ("user-service", "warning", "Profile read latency elevated during gateway traffic spike"),
                ],
            )
            incident_id = _insert_incident(
                conn,
                scenario=scenario,
                severity="high",
                affected_service="api-gateway",
                root_cause="traffic spike at api-gateway",
                suggested_fix="Apply rate limits, scale gateway workers, and cache hot read paths before traffic reaches dependencies.",
                explanation="Gateway throughput is well above baseline and downstream services show correlated latency under fan-out load.",
                downstream=["auth-service", "notification-service", "payment-service", "user-service"],
            )

        else:
            rng = random.Random()
            affected = rng.sample(["auth-service", "user-service", "payment-service", "notification-service"], 3)
            for service in affected:
                _update_service(
                    conn,
                    service,
                    status="degraded",
                    latency_ms=rng.randint(180, 420),
                    error_rate=round(rng.uniform(0.035, 0.095), 3),
                    throughput_rpm=rng.randint(90, 260),
                )
            _update_service(conn, "api-gateway", status="degraded", latency_ms=235, error_rate=0.041, throughput_rpm=410)
            _insert_logs(
                conn,
                [
                    ("api-gateway", "warning", "Connection reset observed while proxying an upstream request"),
                    (affected[0], "error", "Retry budget consumed after repeated transport failures"),
                    (affected[1], "warning", "Connection reset by peer during service-to-service call"),
                    (affected[2], "error", "Network retry exhausted; packet loss suspected on internal path"),
                ],
            )
            downstream = sorted(["api-gateway", *affected])
            incident_id = _insert_incident(
                conn,
                scenario=scenario,
                severity="medium",
                affected_service="network",
                root_cause="simulated network instability",
                suggested_fix="Check packet loss, DNS resolution, retry jitter, and service-mesh connection health.",
                explanation="Several unrelated services degraded together while logs show connection resets and exhausted retries.",
                downstream=downstream,
            )

        _insert_metric_snapshot(conn)
        return {
            "scenario": scenario,
            "incident": _incident_detail(conn, incident_id),
            "services": fetch_services(conn),
            "message": f"Scenario '{scenario}' applied and new incident generated.",
        }


def reset_simulation() -> None:
    seed_database(clear=True)
