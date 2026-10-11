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
  const view = request.nextUrl.searchParams.get("view") ?? "comments";
  const cursor = request.nextUrl.searchParams.get("cursor");
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  try {
    if (view === "state") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/collaboration-state`,
        ),
      );
    }
    return NextResponse.json(
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/comments?${query.toString()}`,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?: "token" | "comment" | "resolve";
  body?: string;
  parentCommentId?: string;
  anchor?: Record<string, unknown>;
  mentionUserIds?: string[];
  commentId?: string;
  resolved?: boolean;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; nodeId: string }> },
) {
  const { workspaceId, nodeId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    if (body.action === "token") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/realtime-token`,
          { method: "POST" },
        ),
      );
    }
    if (body.action === "comment") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(nodeId)}/comments`,
          {
            method: "POST",
            body: JSON.stringify({
              body: body.body,
              parentCommentId: body.parentCommentId,
              anchor: body.anchor ?? {},
              mentionUserIds: body.mentionUserIds ?? [],
            }),
          },
        ),
        { status: 201 },
      );
    }
    if (body.action === "resolve") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/nodes/${encodeURIComponent(
            nodeId,
          )}/comments/${encodeURIComponent(body.commentId ?? "")}/resolve`,
          {
            method: "POST",
            body: JSON.stringify({ resolved: body.resolved !== false }),
          },
        ),
      );
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown collaboration action." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
