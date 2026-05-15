from typing import Literal

ServiceStatus = Literal["healthy", "degraded", "down"]
LogLevel = Literal["info", "warning", "error", "critical"]
IncidentSeverity = Literal["low", "medium", "high", "critical"]

SERVICE_NAMES = [
    "api-gateway",
    "auth-service",
    "user-service",
    "payment-service",
    "notification-service",
    "database",
]

VALID_SCENARIOS = {
    "database_latency",
    "auth_failure",
    "payment_timeout",
    "api_gateway_spike",
    "network_packet_loss",
}
