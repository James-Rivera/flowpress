import { NextRequest, NextResponse } from "next/server";

export function withPublicApiCors(request: NextRequest, response: NextResponse) {
  const requestOrigin = request.headers.get("origin");
  const origin = requestOrigin ?? "*";

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Expose-Headers", "Server-Timing");
  response.headers.set("Access-Control-Allow-Credentials", "false");
  response.headers.set("Vary", "Origin");
  return response;
}

export function buildPublicApiOptionsResponse(request: NextRequest) {
  return withPublicApiCors(request, new NextResponse(null, { status: 204 }));
}
