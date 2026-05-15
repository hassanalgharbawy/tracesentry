import type {
  Incident,
  IncidentDetail,
  LogEntry,
  LogLevel,
  Metric,
  Scenario,
  Service,
  SimulationResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      detail = parsed.detail;
    } catch {
      detail = undefined;
    }
    const message = detail ?? body;
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getServices: () => request<Service[]>("/api/services"),
  getMetrics: (serviceName?: string) =>
    request<Metric[]>(serviceName ? `/api/metrics/${serviceName}` : "/api/metrics"),
  getLogs: (filters: { service?: string; level?: LogLevel | "all"; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters.service && filters.service !== "all") params.set("service", filters.service);
    if (filters.level && filters.level !== "all") params.set("level", filters.level);
    if (filters.limit) params.set("limit", String(filters.limit));
    const query = params.toString();
    return request<LogEntry[]>(`/api/logs${query ? `?${query}` : ""}`);
  },
  getIncidents: () => request<Incident[]>("/api/incidents"),
  getIncident: (incidentId: string) => request<IncidentDetail>(`/api/incidents/${incidentId}`),
  simulate: (scenario: Scenario) =>
    request<SimulationResponse>(`/api/simulate/${scenario}`, { method: "POST" }),
  reset: () => request<{ status: string; message: string }>("/api/reset", { method: "POST" }),
};
