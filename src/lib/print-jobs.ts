import {
  mkdir,
  opendir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, BlobPreconditionFailedError, copy, del, get, head, list, put } from "@vercel/blob";

export type JobStatus = "pending" | "printing" | "done";
export type JobBucket = "active" | "done";
export type FileKind = "pdf" | "image" | "text" | "office" | "other";

type JobMetadata = {
  name: string;
  size: string;
  copies: string;
  color: string;
  folder: string;
  status: JobStatus;
};

export type PrintJob = {
  filename: string;
  timestamp: number;
  bucket: JobBucket;
  relativePath: string;
  metadata: JobMetadata;
};

export type BatchManifest = {
  batchId: string;
  createdAt: number;
  name: string;
  jobs: Array<{
    filename: string;
    relativePath: string;
    status: "pending";
  }>;
};

export type StoredFileResult = {
  body: Buffer | ReadableStream<Uint8Array>;
  fileName: string;
  mimeType: string;
};

type FolderNode = {
  name: string;
  path: string;
  folders: FolderNode[];
  fileCount: number;
};

type StorageDriver = "filesystem" | "blob";

const STATUS_VALUES: JobStatus[] = ["pending", "printing", "done"];
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log"]);
const OFFICE_EXTENSIONS = new Set([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
const jobLocks = new Map<string, Promise<void>>();
const DEFAULT_BLOB_PREFIX = "cjnet-print";

function getStorageDriver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER?.trim().toLowerCase();

  if (configured === "filesystem" || configured === "blob") {
    return configured;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return "blob";
  }

  return "filesystem";
}

function getBlobPrefix() {
  const configured = process.env.BLOB_PATH_PREFIX?.trim();
  const prefix = configured || DEFAULT_BLOB_PREFIX;
  return prefix.replace(/^\/+|\/+$/g, "");
}

function resolveBaseUploadsDir() {
  const configuredPath = process.env.UPLOADS_DIR?.trim();

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

function getUploadsDir() {
  return resolveBaseUploadsDir();
}

function getDoneDir() {
  return path.join(getUploadsDir(), "done");
}

export function getUploadsRootDir() {
  return getUploadsDir();
}

export function getBatchesDir() {
  return path.join(getUploadsDir(), "_batches");
}

function getMetadataPath(dir: string, filename: string) {
  return path.join(dir, `${filename}.json`);
}

function getBlobFilePath(bucket: JobBucket, relativePath: string) {
  const cleanRelativePath = sanitizeJobPath(
    bucket === "done" ? relativePath.replace(/^done\//, "") : relativePath
  );

  return `${getBlobPrefix()}/files/${bucket}/${cleanRelativePath}`;
}

function getBlobMetadataPath(bucket: JobBucket, relativePath: string) {
  const cleanRelativePath = sanitizeJobPath(
    bucket === "done" ? relativePath.replace(/^done\//, "") : relativePath
  );

  return `${getBlobPrefix()}/metadata/${bucket}/${cleanRelativePath}.json`;
}

function getBlobBatchPath(batchId: string) {
  return `${getBlobPrefix()}/batches/${batchId}.json`;
}

function extractRelativePathFromBlobPath(pathname: string, bucket: JobBucket) {
  const prefix = `${getBlobPrefix()}/files/${bucket}/`;
  const relativePath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;

  return bucket === "done" ? `done/${relativePath}` : relativePath;
}

function extractTimestamp(filename: string, fallback: number) {
  const [prefix] = filename.split("-");
  const parsed = Number(prefix);

  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeMetadata(raw: unknown): JobMetadata {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const folder = typeof data.folder === "string" ? data.folder.trim() : "";

  return {
    name: typeof data.name === "string" ? data.name : "",
    size: typeof data.size === "string" ? data.size : "",
    copies: typeof data.copies === "string" ? data.copies : "",
    color: typeof data.color === "string" ? data.color : "",
    folder: folder || "General",
    status: isValidStatus(data.status) ? data.status : "pending",
  };
}

async function readMetadata(metadataPath: string): Promise<JobMetadata> {
  try {
    const rawText = await readFile(metadataPath, "utf-8");
    const rawJson = JSON.parse(rawText) as unknown;
    return normalizeMetadata(rawJson);
  } catch {
    return normalizeMetadata({});
  }
}

async function writeMetadata(metadataPath: string, metadata: JobMetadata) {
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

async function blobText(pathname: string) {
  try {
    const result = await get(pathname, { access: "private", useCache: false });

    if (!result || result.statusCode !== 200) {
      return null;
    }

    return await new Response(result.stream).text();
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }

    throw error;
  }
}

async function putPrivateJson(pathname: string, payload: unknown, ifMatch?: string) {
  await put(pathname, JSON.stringify(payload, null, 2), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    ...(ifMatch ? { ifMatch } : {}),
  });
}

async function listAllBlobs(prefix: string) {
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;

  do {
    const response = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...response.blobs);
    cursor = response.hasMore ? response.cursor : undefined;
  } while (cursor);

  return blobs;
}

async function readBlobMetadata(
  bucket: JobBucket,
  relativePath: string
): Promise<{ metadata: JobMetadata; etag: string | null }> {
  const metadataPath = getBlobMetadataPath(bucket, relativePath);
  const text = await blobText(metadataPath);

  if (!text) {
    return { metadata: normalizeMetadata({}), etag: null };
  }

  try {
    const metadataHead = await head(metadataPath);
    return {
      metadata: normalizeMetadata(JSON.parse(text) as unknown),
      etag: metadataHead.etag,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { metadata: normalizeMetadata(JSON.parse(text) as unknown), etag: null };
    }

    throw error;
  }
}

async function listBlobJobs(bucket: JobBucket): Promise<PrintJob[]> {
  const prefix = `${getBlobPrefix()}/files/${bucket}/`;
  const blobs = await listAllBlobs(prefix);
  const jobs = await Promise.all(
    blobs.map(async (blob) => {
      const relativePath = extractRelativePathFromBlobPath(blob.pathname, bucket);
      const fileName = relativePath.split("/").pop() ?? "file";
      const metadataResult = await readBlobMetadata(bucket, relativePath);

      return {
        filename: fileName,
        timestamp: extractTimestamp(fileName, blob.uploadedAt.getTime()),
        bucket,
        relativePath,
        metadata: metadataResult.metadata,
      } satisfies PrintJob;
    })
  );

  return jobs.sort((a, b) => a.timestamp - b.timestamp);
}

async function getBlobJob(bucket: JobBucket, relativePath: string): Promise<PrintJob | null> {
  const cleanRelativePath =
    bucket === "done" ? sanitizeJobPath(relativePath).replace(/^done\//, "") : sanitizeJobPath(relativePath);

  if (!cleanRelativePath) {
    return null;
  }

  try {
    const blobPath = getBlobFilePath(bucket, cleanRelativePath);
    const blobHead = await head(blobPath);
    const metadataResult = await readBlobMetadata(bucket, cleanRelativePath);
    const fileName = cleanRelativePath.split("/").pop() ?? "file";

    return {
      filename: fileName,
      timestamp: extractTimestamp(fileName, blobHead.uploadedAt.getTime()),
      bucket,
      relativePath: bucket === "done" ? `done/${cleanRelativePath}` : cleanRelativePath,
      metadata: metadataResult.metadata,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }

    throw error;
  }
}

async function withJobLock<T>(jobPath: string, action: () => Promise<T>) {
  const previous = jobLocks.get(jobPath) ?? Promise.resolve();
  let release: () => void = () => {};

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  jobLocks.set(jobPath, previous.then(() => current));
  await previous;

  try {
    return await action();
  } finally {
    release();

    if (jobLocks.get(jobPath) === current) {
      jobLocks.delete(jobPath);
    }
  }
}

function isValidStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value as JobStatus);
}

export function sanitizeFilename(filename: string) {
  return path.basename(filename).trim();
}

export function sanitizeFolderName(folder: string) {
  const normalized = folder.replace(/\\/g, "/").trim();
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9 _-]/g, ""))
    .filter(Boolean);

  return segments.length > 0 ? segments.join("/") : "General";
}

export function sanitizeJobPath(jobPath: string) {
  const normalized = path
    .normalize(jobPath)
    .replace(/^([.][.][/\\])+/, "")
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/")
    .trim();

  if (!normalized || normalized.includes("..")) {
    return "";
  }

  return normalized;
}

function getFileExtension(filename: string) {
  return path.extname(filename).toLowerCase();
}

export function getFileKind(filename: string): FileKind {
  const extension = getFileExtension(filename);

  if (extension === ".pdf") {
    return "pdf";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (OFFICE_EXTENSIONS.has(extension)) {
    return "office";
  }

  return "other";
}

export function isPreviewSupported(filename: string) {
  const kind = getFileKind(filename);
  return kind === "pdf" || kind === "image" || kind === "text";
}

export function getMimeType(filename: string) {
  const extension = getFileExtension(filename);

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".txt" || extension === ".log") return "text/plain; charset=utf-8";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".csv") return "text/csv; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === ".xls") return "application/vnd.ms-excel";
  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (extension === ".ppt") return "application/vnd.ms-powerpoint";
  if (extension === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  return "application/octet-stream";
}

async function listJobsInDirectory(
  directory: string,
  bucket: JobBucket,
  relativePrefix = ""
): Promise<PrintJob[]> {
  const jobs: PrintJob[] = [];

  try {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (bucket === "active" && !relativePrefix && entry.name === "done") {
          continue;
        }

        const nestedPrefix = relativePrefix
          ? `${relativePrefix}/${entry.name}`
          : entry.name;
        const nestedJobs = await listJobsInDirectory(
          path.join(directory, entry.name),
          bucket,
          nestedPrefix
        );
        jobs.push(...nestedJobs);
        continue;
      }

      if (!entry.isFile() || entry.name.endsWith(".json")) {
        continue;
      }

      const fullPath = path.join(directory, entry.name);
      const stats = await stat(fullPath);
      const metadata = await readMetadata(getMetadataPath(directory, entry.name));

      jobs.push({
        filename: entry.name,
        timestamp: extractTimestamp(entry.name, stats.mtimeMs),
        bucket,
        relativePath: relativePrefix
          ? `${relativePrefix}/${entry.name}`
          : entry.name,
        metadata,
      });
    }
  } catch {
    return [];
  }

  return jobs.sort((a, b) => a.timestamp - b.timestamp);
}

export async function listUploadJobs(): Promise<PrintJob[]> {
  if (getStorageDriver() === "blob") {
    return listBlobJobs("active");
  }

  return listJobsInDirectory(getUploadsDir(), "active");
}

export async function listDoneJobs(): Promise<PrintJob[]> {
  if (getStorageDriver() === "blob") {
    return listBlobJobs("done");
  }

  return listJobsInDirectory(getDoneDir(), "done", "done");
}

export async function getUploadJob(filename: string): Promise<PrintJob | null> {
  const safeRelativePath = sanitizeJobPath(filename);

  if (!safeRelativePath || safeRelativePath.startsWith("done/")) {
    return null;
  }

  if (getStorageDriver() === "blob") {
    return getBlobJob("active", safeRelativePath);
  }

  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, safeRelativePath);

  if (!(await fileExists(filePath))) {
    return null;
  }

  const stats = await stat(filePath);
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const metadata = await readMetadata(getMetadataPath(fileDir, fileName));

  return {
    filename: fileName,
    timestamp: extractTimestamp(fileName, stats.mtimeMs),
    bucket: "active",
    relativePath: safeRelativePath,
    metadata,
  };
}

export async function hasOtherPrintingJob(currentFilename: string) {
  const safeCurrentPath = sanitizeJobPath(currentFilename);
  const jobs = await listUploadJobs();

  return jobs.some(
    (job) => job.metadata.status === "printing" && job.relativePath !== safeCurrentPath
  );
}

export async function promoteNextPendingJobToPrinting() {
  const jobs = await listUploadJobs();

  if (jobs.some((job) => job.metadata.status === "printing")) {
    return null;
  }

  const pendingJobs = jobs.filter((job) => job.metadata.status === "pending");

  for (const pendingJob of pendingJobs) {
    const promoted = await setUploadJobStatusWithTransitions(
      pendingJob.relativePath,
      "printing",
      ["pending"]
    );

    if (promoted) {
      return pendingJob.relativePath;
    }
  }

  return null;
}

export async function setUploadJobStatus(filename: string, status: JobStatus) {
  return setUploadJobStatusWithTransitions(filename, status, STATUS_VALUES);
}

export async function setUploadJobStatusWithTransitions(
  filename: string,
  status: JobStatus,
  allowedFrom: JobStatus[]
) {
  const safeRelativePath = sanitizeJobPath(filename);

  if (!safeRelativePath || safeRelativePath.startsWith("done/")) {
    return false;
  }

  if (getStorageDriver() === "blob") {
    return withJobLock(safeRelativePath, async () => {
      const currentJob = await getBlobJob("active", safeRelativePath);

      if (!currentJob) {
        return false;
      }

      const metadataResult = await readBlobMetadata("active", safeRelativePath);

      if (!allowedFrom.includes(metadataResult.metadata.status)) {
        return false;
      }

      try {
        await putPrivateJson(
          getBlobMetadataPath("active", safeRelativePath),
          { ...metadataResult.metadata, status },
          metadataResult.etag ?? undefined
        );
        return true;
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) {
          return false;
        }

        throw error;
      }
    });
  }

  return withJobLock(safeRelativePath, async () => {
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, safeRelativePath);

    if (!(await fileExists(filePath))) {
      return false;
    }

    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const metadataPath = getMetadataPath(fileDir, fileName);
    const currentMetadata = await readMetadata(metadataPath);

    if (!allowedFrom.includes(currentMetadata.status)) {
      return false;
    }

    await writeMetadata(metadataPath, { ...currentMetadata, status });
    return true;
  });
}

export async function moveUploadJobToDone(filename: string, expectedStatus?: JobStatus) {
  const safeRelativePath = sanitizeJobPath(filename);

  if (!safeRelativePath || safeRelativePath.startsWith("done/")) {
    return false;
  }

  if (getStorageDriver() === "blob") {
    return withJobLock(safeRelativePath, async () => {
      const currentJob = await getBlobJob("active", safeRelativePath);

      if (!currentJob) {
        return false;
      }

      const metadataResult = await readBlobMetadata("active", safeRelativePath);

      if (expectedStatus && metadataResult.metadata.status !== expectedStatus) {
        return false;
      }

      const fileName = safeRelativePath.split("/").pop() ?? "file";
      const activeFilePath = getBlobFilePath("active", safeRelativePath);
      const doneFilePath = getBlobFilePath("done", safeRelativePath);

      await copy(activeFilePath, doneFilePath, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: getMimeType(fileName),
      });
      await putPrivateJson(getBlobMetadataPath("done", safeRelativePath), {
        ...metadataResult.metadata,
        status: "done",
      });
      await del([
        activeFilePath,
        getBlobMetadataPath("active", safeRelativePath),
      ]);

      return true;
    });
  }

  return withJobLock(safeRelativePath, async () => {
    const uploadsDir = getUploadsDir();
    const doneDir = getDoneDir();
    const sourceFilePath = path.join(uploadsDir, safeRelativePath);

    if (!(await fileExists(sourceFilePath))) {
      return false;
    }

    const relativeDir = path.dirname(safeRelativePath);
    const fileName = path.basename(safeRelativePath);
    const targetDir =
      relativeDir && relativeDir !== "." ? path.join(doneDir, relativeDir) : doneDir;

    await mkdir(targetDir, { recursive: true });

    const sourceDir = path.dirname(sourceFilePath);
    const sourceMetadataPath = getMetadataPath(sourceDir, fileName);
    const doneMetadataPath = getMetadataPath(targetDir, fileName);
    const metadata = await readMetadata(sourceMetadataPath);

    if (expectedStatus && metadata.status !== expectedStatus) {
      return false;
    }

    await rename(sourceFilePath, path.join(targetDir, fileName));

    if (await fileExists(sourceMetadataPath)) {
      await rename(sourceMetadataPath, doneMetadataPath);
    }

    await writeMetadata(doneMetadataPath, { ...metadata, status: "done" });
    return true;
  });
}

export async function moveDoneJobToPending(filename: string) {
  const safeRelativePath = sanitizeJobPath(filename).replace(/^done\//, "");

  if (!safeRelativePath) {
    return false;
  }

  if (getStorageDriver() === "blob") {
    return withJobLock(`done/${safeRelativePath}`, async () => {
      const currentJob = await getBlobJob("done", safeRelativePath);

      if (!currentJob) {
        return false;
      }

      const metadataResult = await readBlobMetadata("done", safeRelativePath);
      const fileName = safeRelativePath.split("/").pop() ?? "file";
      const doneFilePath = getBlobFilePath("done", safeRelativePath);
      const activeFilePath = getBlobFilePath("active", safeRelativePath);

      await copy(doneFilePath, activeFilePath, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: getMimeType(fileName),
      });
      await putPrivateJson(getBlobMetadataPath("active", safeRelativePath), {
        ...metadataResult.metadata,
        status: "pending",
      });
      await del([
        doneFilePath,
        getBlobMetadataPath("done", safeRelativePath),
      ]);

      return true;
    });
  }

  const uploadsDir = getUploadsDir();
  const doneDir = getDoneDir();
  const doneFilePath = path.join(doneDir, safeRelativePath);

  if (!(await fileExists(doneFilePath))) {
    return false;
  }

  const relativeDir = path.dirname(safeRelativePath);
  const fileName = path.basename(safeRelativePath);
  const targetDir =
    relativeDir && relativeDir !== "." ? path.join(uploadsDir, relativeDir) : uploadsDir;
  await mkdir(targetDir, { recursive: true });

  const doneFileDir = path.dirname(doneFilePath);
  const doneMetadataPath = getMetadataPath(doneFileDir, fileName);
  const uploadsMetadataPath = getMetadataPath(targetDir, fileName);
  const metadata = await readMetadata(doneMetadataPath);

  await rename(doneFilePath, path.join(targetDir, fileName));

  if (await fileExists(doneMetadataPath)) {
    await rename(doneMetadataPath, uploadsMetadataPath);
  }

  await writeMetadata(uploadsMetadataPath, { ...metadata, status: "pending" });
  return true;
}

export async function getBatchManifest(batchId: string): Promise<BatchManifest | null> {
  const safeBatchId = batchId.replace(/[^a-zA-Z0-9_-]/g, "");

  if (!safeBatchId) {
    return null;
  }

  if (getStorageDriver() === "blob") {
    const text = await blobText(getBlobBatchPath(safeBatchId));

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as BatchManifest;
    } catch {
      return null;
    }
  }

  const manifestPath = path.join(getBatchesDir(), `${safeBatchId}.json`);

  try {
    const text = await readFile(manifestPath, "utf-8");
    return JSON.parse(text) as BatchManifest;
  } catch {
    return null;
  }
}

export async function storeUploadedBatch({
  batchId,
  customerName,
  size,
  copies,
  color,
  folder,
  files,
}: {
  batchId: string;
  customerName: string;
  size: string;
  copies: string;
  color: string;
  folder: string;
  files: File[];
}) {
  const normalizedFolder = sanitizeFolderName(folder);
  const jobs: BatchManifest["jobs"] = [];

  if (getStorageDriver() === "blob") {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const safeOriginalName = file.name
        .replace(/\\/g, "")
        .replace(/\//g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      const originalName = safeOriginalName || "upload.bin";
      const uniqueFileName = `${Date.now()}-${batchId}-${index}-${originalName}`;
      const relativePath = `${normalizedFolder}/${uniqueFileName}`;

      await put(getBlobFilePath("active", relativePath), file, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: file.type || getMimeType(originalName),
        multipart: file.size > 5 * 1024 * 1024,
      });
      await putPrivateJson(getBlobMetadataPath("active", relativePath), {
        name: customerName,
        size: size || String(file.size),
        copies,
        color,
        folder: normalizedFolder,
        batchId,
        originalFilename: originalName,
        status: "pending",
      });

      jobs.push({
        filename: originalName,
        relativePath,
        status: "pending",
      });
    }

    await putPrivateJson(getBlobBatchPath(batchId), {
      batchId,
      createdAt: Date.now(),
      name: customerName,
      jobs,
    } satisfies BatchManifest);

    return { jobs, normalizedFolder };
  }

  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  const targetFolderPath = path.join(uploadsDir, normalizedFolder);
  await mkdir(targetFolderPath, { recursive: true });

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
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
    await writeMetadata(metadataPath, {
      name: customerName,
      size: size || String(file.size),
      copies,
      color,
      folder: normalizedFolder,
      status: "pending",
    });

    jobs.push({
      filename: originalName,
      relativePath: `${normalizedFolder}/${uniqueFileName}`,
      status: "pending",
    });
  }

  const batchesDir = getBatchesDir();
  await mkdir(batchesDir, { recursive: true });
  await writeFile(
    path.join(batchesDir, `${batchId}.json`),
    JSON.stringify(
      {
        batchId,
        createdAt: Date.now(),
        name: customerName,
        jobs,
      } satisfies BatchManifest,
      null,
      2
    ),
    "utf-8"
  );

  return { jobs, normalizedFolder };
}

export async function readStoredUploadFile(relativePath: string): Promise<StoredFileResult | null> {
  const normalizedRelativePath = sanitizeJobPath(relativePath);

  if (!normalizedRelativePath) {
    return null;
  }

  const bucket: JobBucket = normalizedRelativePath.startsWith("done/") ? "done" : "active";
  const cleanRelativePath =
    bucket === "done" ? normalizedRelativePath.replace(/^done\//, "") : normalizedRelativePath;
  const fileName = cleanRelativePath.split("/").pop() ?? "file";
  const mimeType = getMimeType(fileName);

  if (getStorageDriver() === "blob") {
    try {
      const result = await get(getBlobFilePath(bucket, cleanRelativePath), {
        access: "private",
        useCache: false,
      });

      if (!result || result.statusCode !== 200) {
        return null;
      }

      return {
        body: result.stream,
        fileName,
        mimeType,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }

      throw error;
    }
  }

  const uploadsRoot = getUploadsRootDir();
  const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);

  if (!absolutePath.startsWith(path.resolve(uploadsRoot))) {
    return null;
  }

  try {
    const buffer = await readFile(absolutePath);
    return {
      body: buffer,
      fileName,
      mimeType,
    };
  } catch {
    return null;
  }
}

function buildFolderTreeFromPaths(paths: string[]) {
  type MutableFolderTreeNode = {
    folders: Map<string, MutableFolderTreeNode>;
    fileCount: number;
  };

  const root = new Map<string, MutableFolderTreeNode>();

  for (const relativePath of paths) {
    const clean = relativePath.replace(/^done\//, "");
    const segments = clean.split("/").filter(Boolean);

    if (segments.length <= 1) {
      continue;
    }

    let current = root;
    let currentPath = "";

    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const existing = current.get(segment);
      const node: MutableFolderTreeNode = existing ?? {
        folders: new Map<string, MutableFolderTreeNode>(),
        fileCount: 0,
      };

      if (index === segments.length - 2) {
        node.fileCount += 1;
      }

      current.set(segment, node);
      current = node.folders;
    }
  }

  const toNodes = (
    source: Map<string, MutableFolderTreeNode>,
    parentPath = ""
  ): FolderNode[] =>
    Array.from(source.entries())
      .map(([name, value]) => {
        const nextPath = parentPath ? `${parentPath}/${name}` : name;

        return {
          name,
          path: nextPath,
          folders: toNodes(value.folders, nextPath),
          fileCount: value.fileCount,
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));

  return toNodes(root);
}

async function buildFolderNodeTree(baseDir: string, relativePath = ""): Promise<FolderNode[]> {
  const nodes: FolderNode[] = [];
  let dir;

  try {
    dir = await opendir(baseDir);
  } catch {
    return nodes;
  }

  for await (const entry of dir) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!relativePath && entry.name === "done") {
      continue;
    }

    const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const childAbsolutePath = path.join(baseDir, entry.name);

    const files = await readdir(childAbsolutePath, { withFileTypes: true });
    const fileCount = files.filter(
      (fileEntry) => fileEntry.isFile() && !fileEntry.name.endsWith(".json")
    ).length;
    const folders = await buildFolderNodeTree(childAbsolutePath, childRelativePath);

    nodes.push({
      name: entry.name,
      path: childRelativePath,
      folders,
      fileCount,
    });
  }

  return nodes.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getFolderTree(view: "queue" | "done") {
  if (getStorageDriver() === "blob") {
    const jobs = view === "done" ? await listDoneJobs() : await listUploadJobs();
    return buildFolderTreeFromPaths(jobs.map((job) => job.relativePath));
  }

  const root = view === "done" ? getDoneDir() : getUploadsDir();
  return buildFolderNodeTree(root);
}
