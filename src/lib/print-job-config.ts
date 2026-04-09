import os from "node:os";
import path from "node:path";
import { getAppRole, validateFilesystemStorageRoot } from "@/lib/app-runtime";
import type { StorageDriver } from "@/lib/print-job-types";

const DEFAULT_BLOB_PREFIX = "cjnet-print";
const DEFAULT_RETENTION_HOURS = 72;
let hasLoggedStorageRoot = false;

function getConfiguredStorageDriver(): StorageDriver | null {
  const configured = process.env.STORAGE_DRIVER?.trim().toLowerCase();

  if (configured === "filesystem" || configured === "blob") {
    return configured;
  }

  return null;
}

export function getStorageDriver(): StorageDriver {
  const configured = getConfiguredStorageDriver();

  if (configured) {
    return configured;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return "blob";
  }

  return "filesystem";
}

export function getActiveStorageDriver() {
  return getStorageDriver();
}

export function getStorageSetupError() {
  const appRole = getAppRole();
  const storageDriver = getStorageDriver();

  if (appRole === "frontend") {
    return null;
  }

  if (process.env.NODE_ENV === "production" && storageDriver !== "filesystem") {
    return "Backend production mode requires STORAGE_DRIVER=filesystem.";
  }

  if (storageDriver !== "filesystem") {
    return null;
  }

  const uploadsRoot = resolveBaseUploadsDir();
  return validateFilesystemStorageRoot(uploadsRoot);
}

export function getBlobPrefix() {
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

  if (process.env.VERCEL === "1") {
    return path.join(os.tmpdir(), "cjnet-print", "uploads");
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

function logResolvedStorageRootOnce() {
  if (hasLoggedStorageRoot || getAppRole() !== "backend" || getStorageDriver() !== "filesystem") {
    return;
  }

  hasLoggedStorageRoot = true;
  console.info(`[cjnet-print] filesystem storage root: ${resolveBaseUploadsDir()}`);
}

export function getUploadsDir() {
  logResolvedStorageRootOnce();
  return path.join(resolveBaseUploadsDir(), "active");
}

export function getDoneDir() {
  logResolvedStorageRootOnce();
  return path.join(resolveBaseUploadsDir(), "done");
}

export function getUploadsRootDir() {
  logResolvedStorageRootOnce();
  return resolveBaseUploadsDir();
}

export function getBatchesDir() {
  logResolvedStorageRootOnce();
  return path.join(resolveBaseUploadsDir(), "_batches");
}

export function getMetadataDir(bucket: "active" | "done") {
  logResolvedStorageRootOnce();
  return path.join(resolveBaseUploadsDir(), "_meta", bucket);
}

export function getTmpDir() {
  logResolvedStorageRootOnce();
  return path.join(resolveBaseUploadsDir(), "tmp");
}

export function getUploadRetentionHours() {
  const parsed = Number.parseInt(process.env.UPLOAD_RETENTION_HOURS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_HOURS;
}
