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
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  try {
    return NextResponse.json(
      await nexosophyApi(`/v1/workspaces/${workspaceId}/notes/hierarchy`),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as {
    action?: "create" | "reorder";
    [key: string]: unknown;
  };
  try {
    if (body.action === "reorder") {
      await nexosophyApi(`/v1/workspaces/${workspaceId}/notes/reorder`, {
        method: "POST",
        body: JSON.stringify({
          parentId: body.parentId,
          orderedNodeIds: body.orderedNodeIds,
        }),
      });
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "create") {
      const { action: _action, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/notes/hierarchy`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
        { status: 201 },
      );
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown note hierarchy action." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
