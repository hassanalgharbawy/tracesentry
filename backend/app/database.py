import json
import os
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("TRACESENTRY_DB", Path(__file__).resolve().parent.parent / "tracesentry.db"))


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS services (
                name TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                latency_ms REAL NOT NULL,
                error_rate REAL NOT NULL,
                throughput_rpm INTEGER NOT NULL,
                dependencies TEXT NOT NULL,
                last_seen TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_name TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                latency_ms REAL NOT NULL,
                error_rate REAL NOT NULL,
                throughput_rpm INTEGER NOT NULL,
                FOREIGN KEY(service_name) REFERENCES services(name)
            );

            CREATE INDEX IF NOT EXISTS idx_metrics_service_time
            ON metrics(service_name, timestamp);

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                service_name TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                trace_id TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_logs_service_time
            ON logs(service_name, timestamp);

            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                severity TEXT NOT NULL,
                affected_service TEXT NOT NULL,
                started_at TEXT NOT NULL,
                status TEXT NOT NULL,
                scenario TEXT NOT NULL,
                root_cause TEXT NOT NULL,
                suggested_fix TEXT NOT NULL,
                explanation TEXT NOT NULL,
                affected_downstream_services TEXT NOT NULL
            );
            """
        )
        service_count = conn.execute("SELECT COUNT(*) AS count FROM services").fetchone()["count"]

    if service_count == 0:
        from app.seed import seed_database

        seed_database(clear=True)


def parse_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    return parsed if isinstance(parsed, list) else []


def service_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["dependencies"] = parse_json_list(item.get("dependencies"))
    return item


def incident_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["affected_downstream_services"] = parse_json_list(item.get("affected_downstream_services"))
    return item


def fetch_services(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM services ORDER BY name").fetchall()
    return [service_row_to_dict(row) for row in rows]


def fetch_metrics(
    conn: sqlite3.Connection,
    service_name: str | None = None,
    limit: int = 360,
) -> list[dict[str, Any]]:
    if service_name:
        rows = conn.execute(
            """
            SELECT * FROM metrics
            WHERE service_name = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            """,
            (service_name, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM metrics
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in reversed(rows)]


def fetch_logs(
    conn: sqlite3.Connection,
    service_name: str | None = None,
    level: str | None = None,
    limit: int = 150,
) -> list[dict[str, Any]]:
    filters: list[str] = []
    params: list[Any] = []
    if service_name:
        filters.append("service_name = ?")
        params.append(service_name)
    if level:
        filters.append("level = ?")
        params.append(level)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    rows = conn.execute(
        f"""
        SELECT * FROM logs
        {where_clause}
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
        """,
        (*params, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_incidents(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM incidents ORDER BY started_at DESC").fetchall()
    return [incident_row_to_dict(row) for row in rows]
