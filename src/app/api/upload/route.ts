import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withPublicApiCors, buildPublicApiOptionsResponse } from "@/lib/public-api-response";
import { ensureBackendRoute } from "@/lib/role-guards";
import {
  getActiveStorageDriver,
  getStorageSetupError,
  getUploadsRootDir,
  storeUploadedBatch,
} from "@/lib/print-jobs";
import { getServerUploadLimits, validateUploadFiles } from "@/lib/upload-rules";

export const runtime = "nodejs";

const UPLOAD_LIMITS = getServerUploadLimits();

function createBatchId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(5).toString("hex").toUpperCase();
  return `B-${timestamp}-${random}`;
}

export function OPTIONS(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();
  return deniedResponse ?? buildPublicApiOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  try {
    const storageSetupError = getStorageSetupError();

    if (storageSetupError) {
      return withPublicApiCors(request, NextResponse.json(
        { success: false, error: storageSetupError },
        { status: 503 }
      ));
    }

    const formData = await request.formData();

    const uploadedFiles = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);
    const singleFile = formData.get("file");

    if (uploadedFiles.length === 0 && singleFile instanceof File) {
      uploadedFiles.push(singleFile);
    }

    const name = formData.get("name");
    const size = formData.get("size");
    const copies = formData.get("copies");
    const color = formData.get("color");
    const folder = formData.get("folder");

    if (uploadedFiles.length === 0) {
      return withPublicApiCors(request, NextResponse.json(
        { success: false, error: "At least one file is required" },
        { status: 400 }
      ));
    }

    const validationError = validateUploadFiles(uploadedFiles, UPLOAD_LIMITS);

    if (validationError) {
      return withPublicApiCors(request, NextResponse.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 }
      ));
    }

    const batchId = createBatchId();
    const { jobs } = await storeUploadedBatch({
      batchId,
      customerName: typeof name === "string" ? name : "",
      size: typeof size === "string" && size ? size : "",
      copies: typeof copies === "string" ? copies : "",
      color: typeof color === "string" ? color : "",
      folder: typeof folder === "string" ? folder : "General",
      files: uploadedFiles,
    });

    return withPublicApiCors(request, NextResponse.json({
      success: true,
      batchId,
      uploadedCount: jobs.length,
      jobs,
    }));
  } catch (error) {
    console.error("[api/upload] upload failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cwd: process.cwd(),
      vercel: process.env.VERCEL === "1",
      storageDriver: getActiveStorageDriver(),
      uploadsDir: getUploadsRootDir(),
      hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
      configuredStorageDriver: process.env.STORAGE_DRIVER ?? null,
      configuredUploadsDir: process.env.UPLOADS_DIR ?? null,
    });

    return withPublicApiCors(request, NextResponse.json(
      { success: false, error: "Upload failed due to a server error" },
      { status: 500 }
    ));
  }
}
