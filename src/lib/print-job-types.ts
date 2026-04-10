import type { FileKind } from "@/lib/file-types";

export type JobStatus = "pending" | "printing" | "done";
export type JobBucket = "active" | "done";
export type { FileKind };

export type JobMetadata = {
  name: string;
  size: string;
  copies: string;
  color: string;
  folder: string;
  batchId?: string;
  uploadIndex?: number;
  originalFilename?: string;
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
    uploadIndex?: number;
    status: "pending";
  }>;
};

export type StoredFileResult = {
  body: Buffer | ReadableStream<Uint8Array>;
  fileName: string;
  mimeType: string;
};

export type FolderNode = {
  name: string;
  path: string;
  folders: FolderNode[];
  fileCount: number;
};

export type StorageDriver = "filesystem" | "blob";
