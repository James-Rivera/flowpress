import { ALLOWED_FILE_EXTENSIONS, getFileExtension } from "@/lib/file-types";

type UploadableFile = {
  name: string;
  size: number;
};

export type UploadLimits = {
  maxFileCount: number;
  maxFileSizeMb: number;
  maxBatchSizeMb: number;
  maxFileSizeBytes: number;
  maxBatchSizeBytes: number;
};

function getPositiveInt(rawValue: string | undefined, fallback: number) {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function createLimits(maxFileCount: number, maxFileSizeMb: number, maxBatchSizeMb: number): UploadLimits {
  return {
    maxFileCount,
    maxFileSizeMb,
    maxBatchSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxBatchSizeBytes: maxBatchSizeMb * 1024 * 1024,
  };
}

export function getServerUploadLimits() {
  return createLimits(
    getPositiveInt(process.env.UPLOAD_MAX_FILE_COUNT, 20),
    getPositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 100),
    getPositiveInt(process.env.UPLOAD_MAX_BATCH_SIZE_MB, 500)
  );
}

export function getClientUploadLimits() {
  return createLimits(
    getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT, 20),
    getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB, 100),
    getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB, 500)
  );
}

export function validateUploadFiles(files: UploadableFile[], limits: UploadLimits) {
  if (files.length === 0) {
    return null;
  }

  if (files.length > limits.maxFileCount) {
    return `Maximum ${limits.maxFileCount} files per upload.`;
  }

  let totalBytes = 0;

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      return `Unsupported file type: ${file.name}. Upload PDF, images, Office files, TXT, or CSV only.`;
    }

    if (file.size > limits.maxFileSizeBytes) {
      return `File too large: ${file.name}. Maximum is ${limits.maxFileSizeMb}MB per file.`;
    }

    totalBytes += file.size;
    if (totalBytes > limits.maxBatchSizeBytes) {
      return `Total upload too large. Maximum is ${limits.maxBatchSizeMb}MB per batch.`;
    }
  }

  return null;
}

export function getBatchLookupLimitPerHour() {
  return getPositiveInt(process.env.BATCH_STATUS_LOOKUP_LIMIT_PER_HOUR, 120);
}
