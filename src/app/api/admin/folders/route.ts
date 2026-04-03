import { NextRequest, NextResponse } from "next/server";
import { ensureAdminRequestAuthenticated } from "@/lib/admin-route";
import { getFolderTree } from "@/lib/print-jobs";
import { ensureBackendRoute } from "@/lib/role-guards";

export async function GET(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  const unauthenticatedResponse = ensureAdminRequestAuthenticated(request);

  if (unauthenticatedResponse) {
    return unauthenticatedResponse;
  }

  const view = request.nextUrl.searchParams.get("view") === "done" ? "done" : "queue";
  const folders = await getFolderTree(view);

  return NextResponse.json({
    success: true,
    view,
    folders,
  });
}
