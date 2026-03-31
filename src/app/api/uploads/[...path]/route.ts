import { NextRequest, NextResponse } from "next/server";
import { ensureAdminRequestAuthenticated } from "@/lib/admin-route";
import { readStoredUploadFile } from "@/lib/print-jobs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const unauthenticatedResponse = ensureAdminRequestAuthenticated(request);

  if (unauthenticatedResponse) {
    return unauthenticatedResponse;
  }

  const { path } = await context.params;
  const relativePath = path.join("/");
  const storedFile = await readStoredUploadFile(relativePath);

  if (!storedFile) {
    return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const responseBody =
    storedFile.body instanceof ReadableStream
      ? storedFile.body
      : new Uint8Array(storedFile.body);

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "Content-Type": storedFile.mimeType,
      "Content-Disposition": `${disposition}; filename="${storedFile.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
