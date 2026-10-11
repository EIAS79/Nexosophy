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
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; nodeId: string }> },
) {
  const { workspaceId, nodeId } = await params;
  try {
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/documents/${encodeURIComponent(nodeId)}`,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; nodeId: string }> },
) {
  const { workspaceId, nodeId } = await params;
  const body = (await request.json()) as {
    body?: unknown;
    expectedRevision?: number;
    idempotencyKey?: string;
  };
  try {
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/documents/${encodeURIComponent(nodeId)}`,
        {
          method: "PUT",
          headers: {
            "idempotency-key": body.idempotencyKey ?? crypto.randomUUID(),
          },
          body: JSON.stringify({
            body: body.body,
            expectedRevision: body.expectedRevision,
          }),
        },
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
