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

const STATUS_VALUES: JobStatus[] = ["pending", "printing", "done"];
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log"]);
const OFFICE_EXTENSIONS = new Set([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
const jobLocks = new Map<string, Promise<void>>();

function resolveBaseUploadsDir() {
  const configuredPath = process.env.UPLOADS_DIR?.trim();

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "cjnet-print", "uploads");
  }

  return path.join(process.cwd(), "uploads");
}

function isValidStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value as JobStatus);
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
        relativePath: relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name,
        metadata,
      });
    }
  } catch {
    return [];
  }

  return jobs.sort((a, b) => a.timestamp - b.timestamp);
}

export async function listUploadJobs(): Promise<PrintJob[]> {
  return listJobsInDirectory(getUploadsDir(), "active");
}

export async function listDoneJobs(): Promise<PrintJob[]> {
  return listJobsInDirectory(getDoneDir(), "done", "done");
}

export async function getUploadJob(filename: string): Promise<PrintJob | null> {
  const safeRelativePath = sanitizeJobPath(filename);

  if (!safeRelativePath || safeRelativePath.startsWith("done/")) {
    return null;
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

export function resolveUploadsRelativePath(relativePath: string) {
  const uploadsRoot = getUploadsRootDir();
  const normalizedRelativePath = sanitizeJobPath(relativePath);

  if (!normalizedRelativePath) {
    return null;
  }

  const absolutePath = path.resolve(uploadsRoot, normalizedRelativePath);

  if (!absolutePath.startsWith(path.resolve(uploadsRoot))) {
    return null;
  }

  return {
    absolutePath,
    normalizedRelativePath,
  };
}

type FolderNode = {
  name: string;
  path: string;
  folders: FolderNode[];
  fileCount: number;
};

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
  const root = view === "done" ? getDoneDir() : getUploadsDir();
  return buildFolderNodeTree(root);
}
