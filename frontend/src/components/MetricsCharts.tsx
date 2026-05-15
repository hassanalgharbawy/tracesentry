import { BarChart3, Gauge, LineChart as LineChartIcon, TrendingUp, type LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metric, Service } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";

function chartTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChartPanel({
  title,
  icon: Icon,
  data,
  dataKey,
  color,
  suffix,
  latestValue,
}: {
  title: string;
  icon: LucideIcon;
  data: Record<string, string | number>[];
  dataKey: string;
  color: string;
  suffix: string;
  latestValue: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{latestValue}</p>
        </div>
        <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                color: "#f4f4f5",
              }}
              formatter={(value) => [`${value}${suffix}`, title]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MetricsCharts({
  services,
  metrics,
  selectedService,
  onSelectService,
  isLoading = false,
  error,
}: {
  services: Service[];
  metrics: Metric[];
  selectedService: string;
  onSelectService: (service: string) => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  const data = metrics.map((metric) => ({
    time: chartTime(metric.timestamp),
    latency: Number(metric.latency_ms.toFixed(1)),
    errorRate: Number((metric.error_rate * 100).toFixed(2)),
    throughput: metric.throughput_rpm,
  }));
  const latest = metrics[metrics.length - 1];

  return (
    <Panel
      title="Metrics Over Time"
      description="Rolling latency, error rate, and throughput for the selected service."
      icon={TrendingUp}
      aside={
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          Service
          <select
            value={selectedService}
            onChange={(event) => onSelectService(event.target.value)}
            className="min-h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
          >
            {services.map((service) => (
              <option key={service.name} value={service.name}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading metrics..." /> : null}
      {!isLoading && !error && data.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No metric points available"
          description="Start the backend API or choose a service with seeded metric history."
        />
      ) : null}
      {!isLoading && !error && data.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartPanel
            title="Latency"
            icon={Gauge}
            data={data}
            dataKey="latency"
            color="#22d3ee"
            suffix=" ms"
            latestValue={`${latest?.latency_ms.toFixed(0) ?? 0} ms`}
          />
          <ChartPanel
            title="Error Rate"
            icon={LineChartIcon}
            data={data}
            dataKey="errorRate"
            color="#fb7185"
            suffix="%"
            latestValue={`${((latest?.error_rate ?? 0) * 100).toFixed(2)}%`}
          />
          <ChartPanel
            title="Throughput"
            icon={BarChart3}
            data={data}
            dataKey="throughput"
            color="#a3e635"
            suffix=" rpm"
            latestValue={`${latest?.throughput_rpm ?? 0} rpm`}
          />
        </div>
      ) : null}
    </Panel>
  );
}
