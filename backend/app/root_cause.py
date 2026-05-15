import sqlite3
from statistics import mean, pstdev
from typing import Any

from app.database import incident_row_to_dict, service_row_to_dict


def _fetch_service_map(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    rows = conn.execute("SELECT * FROM services").fetchall()
    return {row["name"]: service_row_to_dict(row) for row in rows}


def _downstream_services(root: str, services: dict[str, dict[str, Any]]) -> list[str]:
    downstream: set[str] = set()
    changed = True
    while changed:
        changed = False
        for name, svc in services.items():
            deps = set(svc["dependencies"])
            if root in deps or deps.intersection(downstream):
                if name != root and name not in downstream:
                    downstream.add(name)
                    changed = True
    return sorted(downstream)


def _latest_metric_stats(conn: sqlite3.Connection, service_name: str) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT * FROM metrics
        WHERE service_name = ?
        ORDER BY timestamp DESC, id DESC
        LIMIT 18
        """,
        (service_name,),
    ).fetchall()
    if len(rows) < 3:
        return {"latency_z": 0, "error_z": 0, "throughput_z": 0}

    latest = dict(rows[0])
    history = [dict(row) for row in rows[1:]]

    def zscore(key: str) -> float:
        values = [float(row[key]) for row in history]
        avg = mean(values)
        sigma = pstdev(values)
        if sigma < 0.001:
            return 0
        return round((float(latest[key]) - avg) / sigma, 2)

    return {
        "latest": latest,
        "latency_z": zscore("latency_ms"),
        "error_z": zscore("error_rate"),
        "throughput_z": zscore("throughput_rpm"),
    }


def detect_anomalies(conn: sqlite3.Connection) -> dict[str, Any]:
    services = _fetch_service_map(conn)
    scores: dict[str, Any] = {}
    for service_name in services:
        stats = _latest_metric_stats(conn, service_name)
        score = max(
            abs(float(stats.get("latency_z", 0))),
            abs(float(stats.get("error_z", 0))),
            abs(float(stats.get("throughput_z", 0))),
        )
        scores[service_name] = {
            "latency_z": stats.get("latency_z", 0),
            "error_z": stats.get("error_z", 0),
            "throughput_z": stats.get("throughput_z", 0),
            "score": round(score, 2),
        }
    return scores


def infer_likely_root(conn: sqlite3.Connection, incident: dict[str, Any]) -> tuple[str, str]:
    services = _fetch_service_map(conn)
    anomaly_scores = detect_anomalies(conn)
    degraded = {name for name, svc in services.items() if svc["status"] in {"degraded", "down"}}

    database = services.get("database", {})
    if database.get("latency_ms", 0) > 200 and {"user-service", "payment-service"}.intersection(degraded):
        return (
            "database",
            "Database latency is well above baseline and direct dependents are degraded, indicating an upstream storage bottleneck.",
        )

    auth = services.get("auth-service", {})
    gateway = services.get("api-gateway", {})
    if auth.get("error_rate", 0) > 0.08 and gateway.get("error_rate", 0) > 0.03:
        return (
            "auth-service",
            "Auth-service error rate is elevated while the gateway reports failed authenticated requests, so gateway impact is likely downstream.",
        )

    payment = services.get("payment-service", {})
    if payment.get("status") in {"degraded", "down"} and payment.get("latency_ms", 0) > 800:
        return (
            "payment-service",
            "Payment latency and error rate are both outside the normal range, matching timeout symptoms on the checkout path.",
        )

    if gateway.get("throughput_rpm", 0) > 800 and gateway.get("latency_ms", 0) > 180:
        return (
            "api-gateway",
            "Gateway throughput is above normal request volume and downstream services show elevated latency, indicating load-driven saturation.",
        )

    if len(degraded) >= 3:
        recent_messages = " ".join(
            row["message"].lower()
            for row in conn.execute(
                "SELECT message FROM logs ORDER BY timestamp DESC, id DESC LIMIT 20"
            ).fetchall()
        )
        if "connection reset" in recent_messages or "retry" in recent_messages or "packet loss" in recent_messages:
            return (
                "network",
                "Multiple unrelated services degraded together while logs show connection resets and retries, which is consistent with packet loss.",
            )

    highest = max(anomaly_scores.items(), key=lambda item: float(item[1]["score"]), default=("unknown", {}))
    root = highest[0]
    return (
        root,
        f"{root} has the highest combined latency, error-rate, or throughput anomaly score among observed services.",
    )


def build_runbook(root: str, incident: dict[str, Any]) -> list[str]:
    if root == "database":
        return [
            "Check database connection pool saturation and slow query logs.",
            "Compare recent migrations and query plans against the healthy baseline.",
            "Reduce non-critical write traffic or enable read-only fallbacks while the bottleneck is isolated.",
        ]
    if root == "auth-service":
        return [
            "Inspect token verification errors and recent auth configuration changes.",
            "Verify signing-key lookup, cache health, and dependency availability.",
            "Restart unhealthy auth workers if failures are localized to a subset of instances.",
        ]
    if root == "payment-service":
        return [
            "Check timeout rates around payment authorization calls.",
            "Fail closed for payment mutations and queue retries with idempotency keys.",
            "Inspect worker saturation, timeout budgets, and recent checkout-path changes.",
        ]
    if root == "api-gateway":
        return [
            "Confirm request volume, top routes, and client retry behavior at the gateway.",
            "Apply rate limits or autoscale gateway workers.",
            "Cache hot read paths and protect downstream services from fan-out overload.",
        ]
    if root == "network":
        return [
            "Check packet loss, DNS, and service-to-service connection reset rates.",
            "Route traffic away from the affected network segment if possible.",
            "Increase retry jitter and circuit-break noisy downstream calls.",
        ]
    return [
        f"Inspect recent logs and metrics for {incident['affected_service']}.",
        "Compare the newest metrics against the healthy baseline.",
        "Verify dependencies before restarting the affected service.",
    ]


def analyze_incident(conn: sqlite3.Connection, incident_id: str) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    if not row:
        return None

    incident = incident_row_to_dict(row)
    services = _fetch_service_map(conn)
    root, explanation = infer_likely_root(conn, incident)
    downstream = incident.get("affected_downstream_services") or _downstream_services(root, services)

    if root == "network":
        downstream = sorted([name for name, svc in services.items() if svc["status"] in {"degraded", "down"}])

    return {
        "likely_root_cause": root,
        "explanation": explanation,
        "affected_downstream_services": downstream,
        "suggested_fix": incident["suggested_fix"],
        "runbook_steps": build_runbook(root, incident),
        "anomaly_scores": detect_anomalies(conn),
    }
