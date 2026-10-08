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
  const view = request.nextUrl.searchParams.get("view") ?? "trash";
  const nodeId = request.nextUrl.searchParams.get("nodeId");
  const cursor = request.nextUrl.searchParams.get("cursor");
  const action = request.nextUrl.searchParams.get("action");
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (action) query.set("action", action);

  try {
    if (view === "versions" && nodeId) {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/versions?${query.toString()}`,
        ),
      );
    }
    if (view === "audit") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/audit?${query.toString()}`,
        ),
      );
    }
    if (view === "retention") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/retention`),
      );
    }
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/trash?${query.toString()}`,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?:
    | "checkpoint"
    | "restoreVersion"
    | "restoreTrash"
    | "deletePermanent"
    | "updateRetention";
  nodeId?: string;
  versionId?: string;
  label?: string;
  trashRetentionDays?: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    switch (body.action) {
      case "checkpoint":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(body.nodeId ?? "")}/versions`,
            {
              method: "POST",
              body: JSON.stringify({ label: body.label }),
            },
          ),
          { status: 201 },
        );
      case "restoreVersion":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(
              body.nodeId ?? "",
            )}/versions/${encodeURIComponent(body.versionId ?? "")}/restore`,
            { method: "POST" },
          ),
        );
      case "restoreTrash":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/trash/${encodeURIComponent(
              body.nodeId ?? "",
            )}/restore`,
            {
              method: "POST",
              headers: { "idempotency-key": crypto.randomUUID() },
            },
          ),
        );
      case "deletePermanent":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/trash/${encodeURIComponent(
              body.nodeId ?? "",
            )}/permanent`,
            {
              method: "DELETE",
              body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
            },
          ),
          { status: 202 },
        );
      case "updateRetention":
        return NextResponse.json(
          await nexosophyApi(`/v1/workspaces/${workspaceId}/retention`, {
            method: "PUT",
            body: JSON.stringify({ trashRetentionDays: body.trashRetentionDays }),
          }),
        );
      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Unknown history action." } },
          { status: 400 },
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
