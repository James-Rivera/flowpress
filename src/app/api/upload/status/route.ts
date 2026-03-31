import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  getBatchesDir,
  listDoneJobs,
  listUploadJobs,
  sanitizeJobPath,
} from "@/lib/print-jobs";

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

const BATCH_LOOKUP_LIMIT_PER_HOUR = getPositiveIntFromEnv(
  "BATCH_STATUS_LOOKUP_LIMIT_PER_HOUR",
  120
);
const BATCH_LOOKUP_WINDOW_MS = 60 * 60 * 1000;
const batchLookupTracker = new Map<string, { count: number; windowStartedAt: number }>();

type StatusValue = "pending" | "printing" | "done" | "missing";

type StatusItem = {
  relativePath: string;
  status: StatusValue;
  queuePosition: number | null;
  queueAhead: number | null;
  filename?: string;
  updatedAt: number;
};

type BatchManifest = {
  batchId: string;
  createdAt: number;
  name: string;
  jobs: Array<{
    filename: string;
    relativePath: string;
    status: "pending";
  }>;
};

function sanitizeBatchId(batchId: string) {
  return batchId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const fallback = "unknown-client";
  return forwardedFor || realIp || fallback;
}

function isBatchLookupRateLimited(request: Request) {
  const now = Date.now();
  const key = getClientKey(request);
  const current = batchLookupTracker.get(key);

  if (!current || now - current.windowStartedAt > BATCH_LOOKUP_WINDOW_MS) {
    batchLookupTracker.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  if (current.count >= BATCH_LOOKUP_LIMIT_PER_HOUR) {
    return true;
  }

  current.count += 1;
  batchLookupTracker.set(key, current);
  return false;
}

function summarize(items: StatusItem[]) {
  return {
    pendingCount: items.filter((item) => item.status === "pending").length,
    printingCount: items.filter((item) => item.status === "printing").length,
    doneCount: items.filter((item) => item.status === "done").length,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const batchParam = sanitizeBatchId(url.searchParams.get("batch") ?? "");
  const directPaths = url.searchParams.getAll("path");
  const listParam = url.searchParams.get("paths") ?? "";

  const parsedListPaths = listParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const requestedPaths = (directPaths.length > 0 ? directPaths : parsedListPaths)
    .map((value) => sanitizeJobPath(value))
    .filter(Boolean);

  const uniquePaths = Array.from(new Set(requestedPaths));

  if (batchParam && isBatchLookupRateLimited(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many status checks. Please wait and try again.",
        summary: { pendingCount: 0, printingCount: 0, doneCount: 0 },
        jobs: [],
      },
      { status: 429 }
    );
  }

  const [activeJobs, doneJobs] = await Promise.all([listUploadJobs(), listDoneJobs()]);
  const pendingQueue = activeJobs.filter((job) => job.metadata.status === "pending");

  const resolveStatus = (relativePath: string, fallbackFilename?: string): StatusItem => {
    const activeJob = activeJobs.find((job) => job.relativePath === relativePath);

    if (activeJob) {
      const isPending = activeJob.metadata.status === "pending";
      const pendingIndex = pendingQueue.findIndex(
        (job) => job.relativePath === activeJob.relativePath
      );

      return {
        relativePath,
        status: activeJob.metadata.status as StatusValue,
        queuePosition: isPending && pendingIndex >= 0 ? pendingIndex + 1 : null,
        queueAhead: isPending && pendingIndex >= 0 ? pendingIndex : null,
        filename: fallbackFilename ?? activeJob.filename,
        updatedAt: activeJob.timestamp,
      };
    }

    const doneJob = doneJobs.find(
      (job) => job.relativePath === relativePath || job.relativePath === `done/${relativePath}`
    );

    if (doneJob) {
      return {
        relativePath,
        status: "done",
        queuePosition: null,
        queueAhead: null,
        filename: fallbackFilename ?? doneJob.filename,
        updatedAt: doneJob.timestamp,
      };
    }

    return {
      relativePath,
      status: "missing",
      queuePosition: null,
      queueAhead: null,
      filename: fallbackFilename,
      updatedAt: Date.now(),
    };
  };

  if (batchParam) {
    const batchesDir = getBatchesDir();
    const manifestPath = path.join(batchesDir, `${batchParam}.json`);

    let manifest: BatchManifest | null = null;

    try {
      const text = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(text) as BatchManifest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Batch not found",
          summary: { pendingCount: 0, printingCount: 0, doneCount: 0 },
          jobs: [],
        },
        { status: 404 }
      );
    }

    const jobs = manifest.jobs.map((job) => resolveStatus(job.relativePath, job.filename));
    const summary = summarize(jobs);

    return NextResponse.json({
      success: true,
      batch: {
        batchId: manifest.batchId,
        createdAt: manifest.createdAt,
        name: manifest.name,
      },
      summary,
      jobs,
    });
  }

  const jobs = uniquePaths.map((relativePath) => resolveStatus(relativePath));
  const summary = {
    pendingCount: pendingQueue.length,
    printingCount: activeJobs.filter((job) => job.metadata.status === "printing").length,
    doneCount: doneJobs.length,
  };

  return NextResponse.json({
    success: true,
    summary,
    jobs,
  });
}
