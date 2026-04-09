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

function setUploadTimingHeaders(response: NextResponse, timings: Record<string, number>) {
  const parts = Object.entries(timings)
    .filter(([, value]) => Number.isFinite(value) && value >= 0)
    .map(([name, value]) => `${name};dur=${value.toFixed(1)}`);

  if (parts.length > 0) {
    response.headers.set("Server-Timing", parts.join(", "));
  }
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
    const shouldDebugTiming = process.env.UPLOAD_DEBUG_TIMING === "1";
    const start = performance.now();

    const storageSetupError = getStorageSetupError();

    if (storageSetupError) {
      return withPublicApiCors(request, NextResponse.json(
        { success: false, error: storageSetupError },
        { status: 503 }
      ));
    }

    const batchId = createBatchId();

    if (shouldDebugTiming) {
      console.info("[api/upload] started", {
        batchId,
        contentLength: request.headers.get("content-length"),
        contentType: request.headers.get("content-type"),
      });
    }

    const parseStart = performance.now();
    const formData = await request.formData();
    const formDataMs = performance.now() - parseStart;

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

    const storeStart = performance.now();
    const { jobs } = await storeUploadedBatch({
      batchId,
      customerName: typeof name === "string" ? name : "",
      size: typeof size === "string" && size ? size : "",
      copies: typeof copies === "string" ? copies : "",
      color: typeof color === "string" ? color : "",
      folder: typeof folder === "string" ? folder : "General",
      files: uploadedFiles,
    });
    const storeMs = performance.now() - storeStart;
    const endToEndMs = performance.now() - start;

    if (shouldDebugTiming) {
      console.info("[api/upload] completed", {
        batchId,
        streaming: false,
        uploadedCount: jobs.length,
        formDataMs: Number(formDataMs.toFixed(1)),
        storeMs: Number(storeMs.toFixed(1)),
        totalMs: Number(endToEndMs.toFixed(1)),
      });
    }

    const response = NextResponse.json({
      success: true,
      batchId,
      uploadedCount: jobs.length,
      jobs,
      ...(shouldDebugTiming
        ? {
            timing: {
              formDataMs,
              storeMs,
              endToEndMs,
            },
          }
        : {}),
    });
    setUploadTimingHeaders(response, { formData: formDataMs, store: storeMs, total: endToEndMs });
    return withPublicApiCors(request, response);
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
