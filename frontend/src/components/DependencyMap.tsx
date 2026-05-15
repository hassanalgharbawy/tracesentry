import { Network } from "lucide-react";
import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { Service, ServiceStatus } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { LoadingState } from "./LoadingState";
import { Panel } from "./Panel";

const POSITIONS: Record<string, { x: number; y: number }> = {
  "api-gateway": { x: 300, y: 20 },
  "auth-service": { x: 20, y: 170 },
  "user-service": { x: 230, y: 180 },
  "payment-service": { x: 455, y: 180 },
  "notification-service": { x: 680, y: 170 },
  database: { x: 335, y: 335 },
};

const STATUS_COLOR: Record<ServiceStatus, { border: string; bg: string; text: string; edge: string }> = {
  healthy: { border: "#10b981", bg: "#052e24", text: "#a7f3d0", edge: "#52525b" },
  degraded: { border: "#f59e0b", bg: "#3b2605", text: "#fde68a", edge: "#f59e0b" },
  down: { border: "#ef4444", bg: "#3f1111", text: "#fecaca", edge: "#ef4444" },
};

export function DependencyMap({
  services,
  isLoading = false,
  error,
}: {
  services: Service[];
  isLoading?: boolean;
  error?: string | null;
}) {
  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = services.map((service) => {
      const colors = STATUS_COLOR[service.status];
      return {
        id: service.name,
        position: POSITIONS[service.name] ?? { x: 0, y: 0 },
        data: {
          label: (
            <div className="text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{service.name}</span>
                <span className="rounded border border-current px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {service.status}
                </span>
              </div>
              <div className="mt-2 text-xs opacity-85">
                {service.latency_ms.toFixed(0)} ms / {(service.error_rate * 100).toFixed(1)}% errors
              </div>
            </div>
          ),
        },
        style: {
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          color: colors.text,
          minWidth: 190,
          padding: 12,
          boxShadow: "0 14px 32px rgba(0, 0, 0, 0.28)",
        },
      };
    });

    const builtEdges: Edge[] = services.flatMap((service) =>
      service.dependencies.map((dependency) => {
        const colors = STATUS_COLOR[service.status];
        return {
          id: `${service.name}-${dependency}`,
          source: service.name,
          target: dependency,
          animated: service.status !== "healthy",
          markerEnd: { type: MarkerType.ArrowClosed, color: colors.edge },
          style: {
            stroke: colors.edge,
            strokeWidth: service.status === "healthy" ? 1.4 : 2.2,
          },
        };
      }),
    );

    return { nodes: builtNodes, edges: builtEdges };
  }, [services]);

  return (
    <Panel
      title="Service Dependency Map"
      description="Edges point from a service to the upstream dependency it calls."
      icon={Network}
      aside={
        <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
          {Object.keys(STATUS_COLOR).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[status as ServiceStatus].border }}
                aria-hidden="true"
              />
              {status}
            </span>
          ))}
        </div>
      }
    >
      {error ? <ErrorNotice message={error} /> : null}
      {isLoading ? <LoadingState label="Loading dependency graph..." /> : null}
      {!isLoading && !error && services.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No services to map"
          description="Start the backend API to render the dependency topology."
        />
      ) : null}
      {!isLoading && !error && services.length > 0 ? (
        <div className="h-[480px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(9, 9, 11, 0.72)"
              nodeColor={(node) => {
                const service = services.find((item) => item.name === node.id);
                return service ? STATUS_COLOR[service.status].border : "#71717a";
              }}
            />
            <Controls />
            <Background color="#3f3f46" gap={24} />
          </ReactFlow>
        </div>
      ) : null}
    </Panel>
  );
}
