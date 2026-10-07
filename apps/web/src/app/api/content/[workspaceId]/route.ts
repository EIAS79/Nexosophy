import { NextResponse, type NextRequest } from "next/server";

import { nexosophyApi, NexosophyApiError } from "../../../../lib/api-server";

function apiError(error: unknown) {
  if (error instanceof NexosophyApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  throw error;
}

function mutationHeaders(idempotencyKey: unknown): HeadersInit;
function mutationHeaders(idempotencyKey: unknown): HeadersInit | undefined {
  return typeof idempotencyKey === "string" && idempotencyKey.length <= 200
    ? { "idempotency-key": idempotencyKey }
    : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const view = request.nextUrl.searchParams.get("view") ?? "children";

  try {
    if (view === "favorites") {
      return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/favorites`));
    }
    if (view === "recent") {
      return NextResponse.json(await nexosophyApi(`/v1/workspaces/${workspaceId}/recent`));
    }
    if (view === "breadcrumbs") {
      const nodeId = request.nextUrl.searchParams.get("nodeId");
      if (!nodeId) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "nodeId is required." } },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/breadcrumbs`,
        ),
      );
    }

    const parentId = request.nextUrl.searchParams.get("parentId") ?? "root";
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = request.nextUrl.searchParams.get("limit") ?? "50";
    const query = new URLSearchParams({ parentId, limit });
    if (cursor) query.set("cursor", cursor);
    return NextResponse.json(
      await nexosophyApi(`/v1/workspaces/${workspaceId}/nodes?${query.toString()}`),
    );
  } catch (error) {
    return apiError(error);
  }
}

type MutationBody = {
  action?: string;
  nodeId?: string;
  parentId?: string | null;
  expectedVersion?: number;
  name?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  favorite?: boolean;
  pinned?: boolean;
  operation?: "move" | "copy" | "trash";
  nodeIds?: string[];
  idempotencyKey?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as MutationBody;
  const headers = mutationHeaders(body.idempotencyKey);

  try {
    switch (body.action) {
      case "create":
        return NextResponse.json(
          await nexosophyApi(`/v1/workspaces/${workspaceId}/nodes`, {
            method: "POST",
            body: JSON.stringify({
              parentId: body.parentId ?? null,
              kind: body.kind,
              name: body.name,
              metadata: body.metadata ?? {},
            }),
          }),
          { status: 201 },
        );
      case "rename":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                name: body.name,
                expectedVersion: body.expectedVersion,
              }),
            },
          ),
        );
      case "move":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/move`,
            {
              method: "POST",
              body: JSON.stringify({
                parentId: body.parentId ?? null,
                expectedVersion: body.expectedVersion,
              }),
            },
          ),
        );
      case "copy":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/copy`,
            {
              method: "POST",
              ...(headers ? { headers } : {}),
              body: JSON.stringify({
                parentId: body.parentId ?? null,
                ...(body.name ? { name: body.name } : {}),
              }),
            },
          ),
        );
      case "trash":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}`,
            { method: "DELETE", ...(headers ? { headers } : {}) },
          ),
        );
      case "restore":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/restore`,
            { method: "POST" },
          ),
        );
      case "favorite":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/favorite`,
            {
              method: "PUT",
              body: JSON.stringify({
                favorite: body.favorite ?? true,
                pinned: body.pinned ?? false,
              }),
            },
          ),
        );
      case "recent":
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/recent`,
          { method: "POST" },
        );
        return new NextResponse(null, { status: 204 });
      case "bulk":
        return NextResponse.json(
          await nexosophyApi(`/v1/workspaces/${workspaceId}/nodes/bulk`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              operation: body.operation,
              nodeIds: body.nodeIds,
              parentId: body.parentId ?? null,
            }),
          }),
        );
      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Unknown content action." } },
          { status: 400 },
        );
    }
  } catch (error) {
    return apiError(error);
  }
}