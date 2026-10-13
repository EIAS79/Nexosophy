"use client";

import type { ContentRelation } from "@nexosophy/contracts";
import { useEffect, useMemo, useState } from "react";

type GraphNode = { id: string; name: string; kind: string };

export function KnowledgeGraph({
  workspaceId,
  focusNodeId,
}: {
  workspaceId: string;
  focusNodeId?: string;
}) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<ContentRelation[]>([]);
  const [status, setStatus] = useState("Loading graph…");

  useEffect(() => {
    const query = new URLSearchParams({ view: "graph", limit: "200" });
    if (focusNodeId) query.set("nodeId", focusNodeId);
    void fetch(`/api/search/${workspaceId}?${query.toString()}`, {
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) {
        setStatus("Unable to load knowledge graph.");
        return;
      }
      const payload = (await response.json()) as {
        nodes: GraphNode[];
        edges: ContentRelation[];
      };
      setNodes(payload.nodes);
      setEdges(payload.edges);
      setStatus("");
    });
  }, [focusNodeId, workspaceId]);

  const positions = useMemo(() => {
    const visible = nodes.slice(0, 60);
    const cx = 360;
    const cy = 260;
    const radius = Math.min(210, 70 + visible.length * 4);
    return Object.fromEntries(
      visible.map((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(visible.length, 1) - Math.PI / 2;
        return [node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }];
      }),
    ) as Record<string, { x: number; y: number }>;
  }, [nodes]);

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Knowledge graph</p>
          <h1>Relations & backlinks</h1>
          <p>Graph edges are typed relations over universal content nodes.</p>
        </div>
        <a className="nx-button nx-button--secondary nx-button--md" href={`/app/workspaces/${workspaceId}/search`}>
          Search workspace
        </a>
      </header>

      <div className="dashboard-card">
        {nodes.length > 0 ? (
          <svg viewBox="0 0 720 520" role="img" aria-label="Knowledge relation graph" style={{ width: "100%", maxHeight: 560 }}>
            {edges.map((edge) => {
              const from = positions[edge.fromNodeId];
              const to = positions[edge.toNodeId];
              if (!from || !to) return null;
              return (
                <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" opacity=".25" />
              );
            })}
            {nodes.slice(0, 60).map((node) => {
              const point = positions[node.id]!;
              return (
                <g key={node.id}>
                  <circle cx={point.x} cy={point.y} r={node.id === focusNodeId ? 22 : 16} fill="currentColor" opacity={node.id === focusNodeId ? ".9" : ".55"} />
                  <text x={point.x} y={point.y + 34} textAnchor="middle" fontSize="11" fill="currentColor">
                    {node.name.slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
        <p aria-live="polite">{status}</p>
      </div>

      <section className="dashboard-card" aria-label="Accessible relation list">
        <h2>Relation list</h2>
        {edges.map((edge) => (
          <p key={edge.id}>
            <a href={`/app/workspaces/${workspaceId}/node/${edge.fromNodeId}`}>
              {nodes.find((node) => node.id === edge.fromNodeId)?.name ?? edge.fromNodeId}
            </a>{" "}
            — {edge.relationType.replaceAll("_", " ")} →{" "}
            <a href={`/app/workspaces/${workspaceId}/node/${edge.toNodeId}`}>
              {nodes.find((node) => node.id === edge.toNodeId)?.name ?? edge.toNodeId}
            </a>
          </p>
        ))}
        {edges.length === 0 && !status ? <p>No relations yet.</p> : null}
      </section>
    </section>
  );
}
