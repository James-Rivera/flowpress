import os from "node:os";
import path from "node:path";
import type { StorageDriver } from "@/lib/print-job-types";

const DEFAULT_BLOB_PREFIX = "cjnet-print";

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
  if (process.env.VERCEL === "1" && getStorageDriver() !== "blob") {
    return "Vercel uploads require Blob storage. Connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.";
  }

  return null;
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

export function getUploadsDir() {
  return resolveBaseUploadsDir();
}

export function getDoneDir() {
  return path.join(getUploadsDir(), "done");
}

export function getUploadsRootDir() {
  return getUploadsDir();
}

export function getBatchesDir() {
  return path.join(getUploadsDir(), "_batches");
}
