import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { getMimeType, resolveUploadsRelativePath } from "@/lib/print-jobs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { path } = await context.params;
  const relativePath = path.join("/");
  const resolved = resolveUploadsRelativePath(relativePath);

  if (!resolved) {
    return NextResponse.json({ success: false, error: "Invalid path" }, { status: 400 });
  }

  try {
    const buffer = await readFile(resolved.absolutePath);
    const fileName = resolved.normalizedRelativePath.split("/").pop() ?? "file";
    const mimeType = getMimeType(fileName);
    const isDownload = request.nextUrl.searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
  }
}
