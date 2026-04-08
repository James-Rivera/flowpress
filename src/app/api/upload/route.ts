import { randomBytes } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import { withPublicApiCors, buildPublicApiOptionsResponse } from "@/lib/public-api-response";
import { ensureBackendRoute } from "@/lib/role-guards";
import {
  getActiveStorageDriver,
  getBatchesDir,
  getStorageSetupError,
  getStorageDriver,
  getTmpDir,
  getUploadsDir,
  getUploadsRootDir,
  sanitizeFolderName,
  storeUploadedBatch,
} from "@/lib/print-jobs";
import { getServerUploadLimits, validateUploadFiles } from "@/lib/upload-rules";
import { ALLOWED_FILE_EXTENSIONS, getFileExtension } from "@/lib/file-types";

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

async function storeFilesystemUploadStreaming(request: NextRequest, batchId: string) {
  const limits = UPLOAD_LIMITS;
  const headers = Object.fromEntries(request.headers.entries());
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new Error("Invalid upload content type");
  }

  if (!request.body) {
    throw new Error("Missing upload body");
  }

  const uploadsDir = getUploadsDir();
  const tmpDir = getTmpDir();
  const batchesDir = getBatchesDir();

  await mkdir(getUploadsRootDir(), { recursive: true });
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });
  await mkdir(batchesDir, { recursive: true });

  let customerName = "";
  let size = "";
  let copies = "";
  let color = "";
  let folder = "General";

  const jobs: Array<{ filename: string; relativePath: string; status: "pending" }> = [];
  const fileWrites: Array<Promise<void>> = [];

  let fileIndex = 0;
  let totalBytes = 0;
  let receivedAnyFile = false;
  let aborted = false;
  let abortError: Error | null = null;

  const normalizedFolderForLater = () => sanitizeFolderName(folder || "General");

  const busboy = Busboy({
    headers,
    limits: {
      files: limits.maxFileCount,
      fileSize: limits.maxFileSizeBytes,
      fields: 20,
      fieldSize: 256 * 1024,
    },
  });

  busboy.on("field", (fieldname, value) => {
    if (typeof value !== "string") {
      return;
    }

    if (fieldname === "name") {
      customerName = value.trim();
      return;
    }

    if (fieldname === "size") {
      size = value.trim();
      return;
    }

    if (fieldname === "copies") {
      copies = value.trim();
      return;
    }

    if (fieldname === "color") {
      color = value.trim();
      return;
    }

    if (fieldname === "folder") {
      folder = value.trim() || "General";
      return;
    }
  });

  busboy.on("filesLimit", () => {
    aborted = true;
    abortError = new Error(`Maximum ${limits.maxFileCount} files per upload.`);
  });

  busboy.on("file", (fieldname, file, info) => {
    if (fieldname !== "file") {
      file.resume();
      return;
    }

    receivedAnyFile = true;

    const rawFilename = typeof info?.filename === "string" ? info.filename : "upload.bin";
    const baseName = path.basename(rawFilename).trim();
    const safeOriginalName = baseName
      .replace(/\\/g, "")
      .replace(/\//g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const originalName = safeOriginalName || "upload.bin";

    const extension = getFileExtension(originalName);
    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      aborted = true;
      abortError = new Error(`Unsupported file type: ${originalName}. Upload PDF, DOCX, JPG, JPEG, or PNG only.`);
      file.resume();
      return;
    }

    const index = fileIndex;
    fileIndex += 1;

    const normalizedFolder = normalizedFolderForLater();
    const uniqueFileName = `${Date.now()}-${batchId}-${index}-${originalName}`;
    const relativePath = `${normalizedFolder}/${uniqueFileName}`;

    const targetFolderPath = path.join(uploadsDir, normalizedFolder);
    const tmpPath = path.join(tmpDir, uniqueFileName);
    const savePath = path.join(targetFolderPath, uniqueFileName);
    const metadataPath = path.join(targetFolderPath, `${uniqueFileName}.json`);

    let fileBytes = 0;

    file.on("data", (chunk: Buffer) => {
      fileBytes += chunk.length;
      totalBytes += chunk.length;

      if (totalBytes > limits.maxBatchSizeBytes && !aborted) {
        aborted = true;
        abortError = new Error(`Total upload too large. Maximum is ${limits.maxBatchSizeMb}MB per batch.`);
        file.unpipe();
        file.resume();
      }
    });

    file.on("limit", () => {
      aborted = true;
      abortError = new Error(`File too large: ${originalName}. Maximum is ${limits.maxFileSizeMb}MB per file.`);
    });

    jobs.push({
      filename: originalName,
      relativePath,
      status: "pending",
    });

    const writePromise = (async () => {
      await mkdir(targetFolderPath, { recursive: true });
      await pipeline(file, createWriteStream(tmpPath));
      await rename(tmpPath, savePath);
      await writeFile(
        metadataPath,
        JSON.stringify(
          {
            name: customerName,
            size: size || String(fileBytes),
            copies,
            color,
            folder: normalizedFolder,
            status: "pending",
          },
          null,
          2
        ),
        "utf-8"
      );
    })();

    fileWrites.push(writePromise);
  });

  const finished = new Promise<void>((resolve, reject) => {
    busboy.on("error", (error) => {
      reject(error);
    });

    busboy.on("finish", () => {
      resolve();
    });
  });

  const nodeStream = Readable.fromWeb(request.body as unknown as NodeWebReadableStream<Uint8Array>);
  nodeStream.pipe(busboy);

  await finished;
  await Promise.all(fileWrites);

  if (aborted) {
    throw abortError ?? new Error("Upload aborted");
  }

  if (!receivedAnyFile || jobs.length === 0) {
    throw new Error("At least one file is required");
  }

  await writeFile(
    path.join(batchesDir, `${batchId}.json`),
    JSON.stringify(
      {
        batchId,
        createdAt: Date.now(),
        name: customerName,
        jobs,
      },
      null,
      2
    ),
    "utf-8"
  );

  return { jobs };
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

    const useStreamingFilesystemUploads =
      process.env.UPLOAD_STREAMING === "1" && getStorageDriver() === "filesystem";

    if (shouldDebugTiming) {
      console.info("[api/upload] started", {
        batchId,
        streaming: useStreamingFilesystemUploads,
        contentLength: request.headers.get("content-length"),
        contentType: request.headers.get("content-type"),
      });
    }

    if (useStreamingFilesystemUploads) {
      const totalStart = performance.now();
      const { jobs } = await storeFilesystemUploadStreaming(request, batchId);
      const totalMs = performance.now() - totalStart;

      if (shouldDebugTiming) {
        console.info("[api/upload] completed", {
          batchId,
          streaming: true,
          uploadedCount: jobs.length,
          totalMs: Number(totalMs.toFixed(1)),
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
                totalMs,
              },
            }
          : {}),
      });
      setUploadTimingHeaders(response, { total: totalMs, endToEnd: performance.now() - start });
      return withPublicApiCors(request, response);
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
