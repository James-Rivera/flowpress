import type { NextRequest } from "next/server";

function getForwardedHeaderValue(request: Pick<NextRequest, "headers">, name: string) {
  return request.headers.get(name)?.split(",")[0]?.trim();
}

export function getRequestOrigin(request: Pick<NextRequest, "headers" | "nextUrl" | "url">) {
  const forwardedProto = getForwardedHeaderValue(request, "x-forwarded-proto");
  const forwardedHost = getForwardedHeaderValue(request, "x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = getForwardedHeaderValue(request, "host");

  if (host) {
    return `${request.nextUrl.protocol}//${host}`;
  }

  return new URL(request.url).origin;
}
