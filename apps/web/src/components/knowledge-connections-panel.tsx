"use client";

import type { ContentRelation, ContentRelationType, Tag } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useState } from "react";

async function post(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`/api/search/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function KnowledgeConnectionsPanel({
  workspaceId,
  nodeId,
}: {
  workspaceId: string;
  nodeId: string;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [relations, setRelations] = useState<{
    outgoing: ContentRelation[];
    backlinks: ContentRelation[];
  }>({ outgoing: [], backlinks: [] });
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [tagsResponse, relationResponse] = await Promise.all([
      fetch(`/api/search/${workspaceId}?view=tags`, { cache: "no-store" }),
      fetch(
        `/api/search/${workspaceId}?view=relations&nodeId=${encodeURIComponent(nodeId)}`,
        { cache: "no-store" },
      ),
    ]);
    if (tagsResponse.ok) setTags(((await tagsResponse.json()) as { items: Tag[] }).items);
    if (relationResponse.ok) setRelations(await relationResponse.json());
  }, [nodeId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTag() {
    const name = window.prompt("New tag name")?.trim();
    if (!name) return;
    const response = await post(workspaceId, { action: "createTag", name });
    if (response.ok) {
      setStatus("Tag created.");
      void load();
    } else setStatus("Could not create tag.");
  }

  async function assignTag() {
    const tagId = window.prompt(
      "Tag ID to assign\n" + tags.map((tag) => `${tag.name}: ${tag.id}`).join("\n"),
    )?.trim();
    if (!tagId) return;
    const response = await post(workspaceId, {
      action: "assignTag",
      nodeId,
      tagId,
    });
    setStatus(response.ok ? "Tag assigned." : "Could not assign tag.");
  }

  async function addRelation() {
    const toNodeId = window.prompt("Target node ID")?.trim();
    if (!toNodeId) return;
    const relationType = (window.prompt(
      "Relation type: related, references, supports, depends_on, contradicts, duplicates, derived_from",
      "related",
    )?.trim() || "related") as ContentRelationType;
    const label = window.prompt("Optional relation label")?.trim() || undefined;
    const response = await post(workspaceId, {
      action: "createRelation",
      nodeId,
      toNodeId,
      relationType,
      label,
    });
    if (response.ok) {
      setStatus("Relation created.");
      void load();
    } else setStatus("Could not create relation.");
  }

  return (
    <section className="dashboard-card" aria-label="Tags, relations and backlinks">
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">Connected knowledge</p>
          <h2>Tags & relations</h2>
        </div>
        <div className="workspace-subnav">
          <button type="button" onClick={() => void createTag()}>New tag</button>
          <button type="button" onClick={() => void assignTag()}>Assign tag</button>
          <button type="button" onClick={() => void addRelation()}>Add relation</button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div>
          <h3>Workspace tags</h3>
          <p>{tags.length ? tags.map((tag) => tag.name).join(" · ") : "No tags yet."}</p>
        </div>
        <div>
          <h3>Outgoing relations</h3>
          {relations.outgoing.map((relation) => (
            <p key={relation.id}>
              {relation.relationType.replaceAll("_", " ")} →{" "}
              <a href={`/app/workspaces/${workspaceId}/node/${relation.toNodeId}`}>
                {relation.toNodeId.slice(0, 8)}
              </a>
            </p>
          ))}
          {relations.outgoing.length === 0 ? <p>No outgoing relations.</p> : null}
        </div>
        <div>
          <h3>Backlinks</h3>
          {relations.backlinks.map((relation) => (
            <p key={relation.id}>
              <a href={`/app/workspaces/${workspaceId}/node/${relation.fromNodeId}`}>
                {relation.fromNodeId.slice(0, 8)}
              </a>{" "}
              → {relation.relationType.replaceAll("_", " ")}
            </p>
          ))}
          {relations.backlinks.length === 0 ? <p>No backlinks.</p> : null}
        </div>
      </div>
      <p aria-live="polite">{status}</p>
    </section>
  );
}
