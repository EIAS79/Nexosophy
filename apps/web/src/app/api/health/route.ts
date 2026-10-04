import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "web",
    status: "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    timestamp: new Date().toISOString(),
  });
}
