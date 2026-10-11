import { NextResponse, type NextRequest } from "next/server";

import { NexosophyApiError, nexosophyApi } from "../../../../../lib/api-server";

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
  { params }: { params: Promise<{ workspaceId: string; nodeId: string }> },
) {
  const { workspaceId, nodeId } = await params;
  const view = request.nextUrl.searchParams.get("view") ?? "surface";
  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete("view");
  try {
    if (view === "viewport") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(
            nodeId,
          )}/viewport?${query.toString()}`,
        ),
      );
    }
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(
          nodeId,
        )}?${query.toString()}`,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?: "settings" | "batch" | "viewport" | "export";
  expectedVersion?: number;
  pageMode?: string;
  backgroundKind?: string;
  paperSize?: string;
  orientation?: string;
  settings?: Record<string, unknown>;
  upserts?: unknown[];
  deleteIds?: string[];
  idempotencyKey?: string;
  originX?: number;
  originY?: number;
  zoom?: number;
  deviceKey?: string;
  format?: string;
  scope?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; nodeId: string }> },
) {
  const { workspaceId, nodeId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    if (body.action === "settings") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(nodeId)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              expectedVersion: body.expectedVersion,
              pageMode: body.pageMode,
              backgroundKind: body.backgroundKind,
              paperSize: body.paperSize,
              orientation: body.orientation,
              settings: body.settings,
            }),
          },
        ),
      );
    }
    if (body.action === "batch") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(
            nodeId,
          )}/elements`,
          {
            method: "POST",
            body: JSON.stringify({
              upserts: body.upserts ?? [],
              deleteIds: body.deleteIds ?? [],
              idempotencyKey: body.idempotencyKey ?? crypto.randomUUID(),
            }),
          },
        ),
      );
    }
    if (body.action === "viewport") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(
          nodeId,
        )}/viewport`,
        {
          method: "PUT",
          body: JSON.stringify({
            originX: body.originX,
            originY: body.originY,
            zoom: body.zoom,
            deviceKey: body.deviceKey ?? "default",
          }),
        },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "export") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/spatial/${encodeURIComponent(
            nodeId,
          )}/export`,
          {
            method: "POST",
            body: JSON.stringify({ format: body.format, scope: body.scope }),
          },
        ),
      );
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown spatial action." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
