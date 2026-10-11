import { NextResponse, type NextRequest } from "next/server";

import { NexosophyApiError, nexosophyApi } from "../../../../lib/api-server";

function errorResponse(error: unknown) {
  if (error instanceof NexosophyApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  throw error;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const view = request.nextUrl.searchParams.get("view") ?? "search";
  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete("view");
  const nodeId = query.get("nodeId");
  query.delete("nodeId");

  try {
    if (view === "tags") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/tags`),
      );
    }
    if (view === "saved") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/saved`),
      );
    }
    if (view === "history") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/history`),
      );
    }
    if (view === "status") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/status`),
      );
    }
    if (view === "graph") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/graph?${query.toString()}`,
        ),
      );
    }
    if (view === "relations" && nodeId) {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/relations`,
        ),
      );
    }
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/search?${query.toString()}`,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?:
    | "createTag"
    | "assignTag"
    | "unassignTag"
    | "createRelation"
    | "deleteRelation"
    | "saveSearch"
    | "deleteSavedSearch"
    | "clearHistory"
    | "reindex";
  nodeId?: string;
  tagId?: string;
  name?: string;
  color?: string;
  toNodeId?: string;
  relationType?: string;
  label?: string;
  relationId?: string;
  query?: Record<string, unknown>;
  shared?: boolean;
  savedSearchId?: string;
  scope?: "workspace" | "node";
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    if (body.action === "createTag") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/tags`, {
          method: "POST",
          body: JSON.stringify({ name: body.name, color: body.color }),
        }),
        { status: 201 },
      );
    }
    if (body.action === "assignTag" || body.action === "unassignTag") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(
          body.nodeId ?? "",
        )}/tags/${encodeURIComponent(body.tagId ?? "")}`,
        {
          method: body.action === "assignTag" ? "POST" : "DELETE",
        },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "createRelation") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(
            body.nodeId ?? "",
          )}/relations`,
          {
            method: "POST",
            body: JSON.stringify({
              toNodeId: body.toNodeId,
              relationType: body.relationType,
              label: body.label,
              metadata: {},
            }),
          },
        ),
        { status: 201 },
      );
    }
    if (body.action === "deleteRelation") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/relations/${encodeURIComponent(
          body.relationId ?? "",
        )}`,
        { method: "DELETE" },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "saveSearch") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/saved`, {
          method: "POST",
          body: JSON.stringify({
            name: body.name,
            query: body.query ?? {},
            shared: body.shared ?? false,
          }),
        }),
        { status: 201 },
      );
    }
    if (body.action === "deleteSavedSearch") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/search/saved/${encodeURIComponent(
          body.savedSearchId ?? "",
        )}`,
        { method: "DELETE" },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "clearHistory") {
      await nexosophyApi(`/v1/workspaces/${workspaceId}/search/history`, {
        method: "DELETE",
      });
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "reindex") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/search/reindex`, {
          method: "POST",
          body: JSON.stringify({
            scope: body.scope ?? "workspace",
            nodeId: body.nodeId,
          }),
        }),
        { status: 202 },
      );
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown search action." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
