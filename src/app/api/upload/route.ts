import { randomBytes } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { storeUploadedBatch } from "@/lib/print-jobs";

export const runtime = "nodejs";

function getPositiveIntFromEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
]);
const MAX_FILE_COUNT = getPositiveIntFromEnv("UPLOAD_MAX_FILE_COUNT", 20);
const MAX_FILE_SIZE_MB = getPositiveIntFromEnv("UPLOAD_MAX_FILE_SIZE_MB", 100);
const MAX_BATCH_SIZE_MB = getPositiveIntFromEnv("UPLOAD_MAX_BATCH_SIZE_MB", 500);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_BATCH_SIZE_BYTES = MAX_BATCH_SIZE_MB * 1024 * 1024;

function createBatchId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(5).toString("hex").toUpperCase();
  return `B-${timestamp}-${random}`;
}

function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

function isFileAllowed(fileName: string) {
  return ALLOWED_FILE_EXTENSIONS.has(getFileExtension(fileName));
}

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { success: false, error: "At least one file is required" },
        { status: 400 }
      );
    }

    if (uploadedFiles.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many files. Maximum is ${MAX_FILE_COUNT} files per batch.`,
        },
        { status: 400 }
      );
    }

    let totalBatchBytes = 0;
    for (const file of uploadedFiles) {
      if (!isFileAllowed(file.name)) {
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported file type for ${file.name}. Allowed: PDF, images, Office docs, TXT, CSV.`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File too large: ${file.name}. Maximum size is ${MAX_FILE_SIZE_MB}MB per file.`,
          },
          { status: 400 }
        );
      }

      totalBatchBytes += file.size;
      if (totalBatchBytes > MAX_BATCH_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `Batch too large. Maximum total upload size is ${MAX_BATCH_SIZE_MB}MB.`,
          },
          { status: 400 }
        );
      }
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

    return NextResponse.json({
      success: true,
      batchId,
      uploadedCount: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("[api/upload] upload failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cwd: process.cwd(),
      vercel: process.env.VERCEL === "1",
    });

    return NextResponse.json(
      { success: false, error: "Upload failed due to a server error" },
      { status: 500 }
    );
  }
}
