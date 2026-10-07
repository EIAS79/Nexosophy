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
  const uploadSessionId = request.nextUrl.searchParams.get("uploadSessionId");
  const assetId = request.nextUrl.searchParams.get("assetId");
  try {
    if (uploadSessionId) {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/uploads/${encodeURIComponent(uploadSessionId)}`,
        ),
      );
    }
    if (assetId) {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/assets/${encodeURIComponent(assetId)}`,
        ),
      );
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "uploadSessionId or assetId is required." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?: "initiate" | "signPart" | "recordPart" | "complete" | "abort" | "download" | "delete";
  uploadSessionId?: string;
  assetId?: string;
  partNumber?: number;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  parentId?: string | null;
  etag?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    switch (body.action) {
      case "initiate":
        return NextResponse.json(
          await nexosophyApi(`/v1/workspaces/${workspaceId}/uploads/initiate`, {
            method: "POST",
            body: JSON.stringify({
              filename: body.filename,
              mimeType: body.mimeType,
              sizeBytes: body.sizeBytes,
              checksumSha256: body.checksumSha256,
              parentId: body.parentId ?? null,
            }),
          }),
          { status: 201 },
        );
      case "signPart":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/uploads/${encodeURIComponent(
              body.uploadSessionId ?? "",
            )}/parts/${body.partNumber ?? 0}/sign`,
            { method: "POST" },
          ),
        );
      case "recordPart":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/uploads/${encodeURIComponent(
              body.uploadSessionId ?? "",
            )}/parts/${body.partNumber ?? 0}`,
            {
              method: "PUT",
              body: JSON.stringify({
                etag: body.etag,
                sizeBytes: body.sizeBytes,
                checksumSha256: body.checksumSha256,
              }),
            },
          ),
        );
      case "complete":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/uploads/${encodeURIComponent(
              body.uploadSessionId ?? "",
            )}/complete`,
            { method: "POST", body: JSON.stringify({ checksumSha256: body.checksumSha256 }) },
          ),
          { status: 202 },
        );
      case "abort":
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/uploads/${encodeURIComponent(
            body.uploadSessionId ?? "",
          )}/abort`,
          { method: "POST" },
        );
        return new NextResponse(null, { status: 204 });
      case "download":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/assets/${encodeURIComponent(
              body.assetId ?? "",
            )}/download-url`,
            { method: "POST" },
          ),
        );
      case "delete":
        return NextResponse.json(
          await nexosophyApi(
            `/v1/workspaces/${workspaceId}/assets/${encodeURIComponent(
              body.assetId ?? "",
            )}`,
            { method: "DELETE" },
          ),
          { status: 202 },
        );
      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Unknown upload action." } },
          { status: 400 },
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
