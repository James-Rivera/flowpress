import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { getFolderTree } from "@/lib/print-jobs";

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const view = request.nextUrl.searchParams.get("view") === "done" ? "done" : "queue";
  const folders = await getFolderTree(view);

  return NextResponse.json({
    success: true,
    view,
    folders,
  });
}
