import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { sanitizeFolderName } from "@/lib/print-jobs";

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

    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const normalizedFolder =
      typeof folder === "string" ? sanitizeFolderName(folder) : "General";
    const targetFolderPath = path.join(uploadsDir, normalizedFolder);
    await mkdir(targetFolderPath, { recursive: true });
    const batchId = createBatchId();

    const jobs: Array<{
      filename: string;
      relativePath: string;
      status: "pending";
    }> = [];

    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const file = uploadedFiles[index];

      const safeOriginalName = file.name
        .replace(/\\/g, "")
        .replace(/\//g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const originalName = safeOriginalName || "upload.bin";
      const uniqueFileName = `${Date.now()}-${batchId}-${index}-${originalName}`;
      const savePath = path.join(targetFolderPath, uniqueFileName);
      const metadataPath = path.join(targetFolderPath, `${uniqueFileName}.json`);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(savePath, buffer);

      const metadata = {
        name: typeof name === "string" ? name : "",
        size: typeof size === "string" && size ? size : String(file.size),
        copies: typeof copies === "string" ? copies : "",
        color: typeof color === "string" ? color : "",
        folder: normalizedFolder,
        batchId,
        originalFilename: originalName,
        status: "pending",
      };

      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

      jobs.push({
        filename: originalName,
        relativePath: `${normalizedFolder}/${uniqueFileName}`,
        status: "pending",
      });
    }

    const batchesDir = path.join(uploadsDir, "_batches");
    await mkdir(batchesDir, { recursive: true });
    await writeFile(
      path.join(batchesDir, `${batchId}.json`),
      JSON.stringify(
        {
          batchId,
          createdAt: Date.now(),
          name: typeof name === "string" ? name : "",
          jobs,
        },
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      batchId,
      uploadedCount: jobs.length,
      jobs,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Upload failed due to a server error" },
      { status: 500 }
    );
  }
}
