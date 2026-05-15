import json
import random
from datetime import datetime, timedelta, timezone

from app.database import get_connection

BASE_SERVICES = {
    "api-gateway": {
        "status": "healthy",
        "latency_ms": 88,
        "error_rate": 0.006,
        "throughput_rpm": 420,
        "dependencies": ["auth-service", "user-service", "payment-service", "notification-service"],
    },
    "auth-service": {
        "status": "healthy",
        "latency_ms": 42,
        "error_rate": 0.004,
        "throughput_rpm": 260,
        "dependencies": ["database"],
    },
    "user-service": {
        "status": "healthy",
        "latency_ms": 55,
        "error_rate": 0.005,
        "throughput_rpm": 210,
        "dependencies": ["database"],
    },
    "payment-service": {
        "status": "healthy",
        "latency_ms": 110,
        "error_rate": 0.008,
        "throughput_rpm": 130,
        "dependencies": ["database"],
    },
    "notification-service": {
        "status": "healthy",
        "latency_ms": 68,
        "error_rate": 0.006,
        "throughput_rpm": 180,
        "dependencies": [],
    },
    "database": {
        "status": "healthy",
        "latency_ms": 24,
        "error_rate": 0.002,
        "throughput_rpm": 780,
        "dependencies": [],
    },
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def seed_database(clear: bool = False) -> None:
    rng = random.Random(17)
    now = utc_now()

    with get_connection() as conn:
        if clear:
            conn.execute("DELETE FROM incidents")
            conn.execute("DELETE FROM logs")
            conn.execute("DELETE FROM metrics")
            conn.execute("DELETE FROM services")

        for name, svc in BASE_SERVICES.items():
            conn.execute(
                """
                INSERT OR REPLACE INTO services
                (name, status, latency_ms, error_rate, throughput_rpm, dependencies, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    svc["status"],
                    svc["latency_ms"],
                    svc["error_rate"],
                    svc["throughput_rpm"],
                    json.dumps(svc["dependencies"]),
                    iso(now),
                ),
            )

        for step in range(24, 0, -1):
            ts = now - timedelta(minutes=step * 5)
            for name, svc in BASE_SERVICES.items():
                latency = max(5, svc["latency_ms"] + rng.uniform(-8, 10))
                error_rate = max(0, svc["error_rate"] + rng.uniform(-0.002, 0.003))
                throughput = max(1, int(svc["throughput_rpm"] + rng.uniform(-28, 32)))
                conn.execute(
                    """
                    INSERT INTO metrics
                    (service_name, timestamp, latency_ms, error_rate, throughput_rpm)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (name, iso(ts), round(latency, 2), round(error_rate, 4), throughput),
                )

        trace_seed = rng.randint(100000, 999999)
        baseline_logs = [
            ("api-gateway", "info", "Request routing completed within baseline latency budget"),
            ("auth-service", "info", "Token validation completed with normal cache hit rate"),
            ("user-service", "info", "Profile read path completed without dependency retries"),
            ("payment-service", "info", "Authorization queue drained within expected processing window"),
            ("notification-service", "info", "Worker heartbeat acknowledged and delivery backlog is empty"),
            ("database", "info", "Connection pool healthy; p95 query latency inside baseline"),
        ]
        for index, (service, level, message) in enumerate(baseline_logs):
            conn.execute(
                """
                INSERT INTO logs (timestamp, service_name, level, message, trace_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    iso(now - timedelta(minutes=20 - index * 2)),
                    service,
                    level,
                    message,
                    f"trace-{trace_seed + index}",
                ),
            )
