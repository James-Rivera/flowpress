import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { isBackendRole } from "@/lib/app-runtime";

export function ensureBackendPage() {
  if (!isBackendRole()) {
    notFound();
  }
}

export function ensureBackendRoute() {
  if (!isBackendRole()) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return null;
}

export function ensureBackendRequest(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  return request;
}

