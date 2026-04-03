import { NextRequest, NextResponse } from "next/server";
import { getBatchLookupLimitPerHour } from "@/lib/upload-rules";
import { buildPublicApiOptionsResponse, withPublicApiCors } from "@/lib/public-api-response";
import {
  getStorageSetupError,
  getBatchManifest,
  sanitizeJobPath,
} from "@/lib/print-jobs";
import { getQueueSnapshot } from "@/lib/print-job-service";
import { ensureBackendRoute } from "@/lib/role-guards";

export const runtime = "nodejs";

const BATCH_LOOKUP_LIMIT_PER_HOUR = getBatchLookupLimitPerHour();
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

export function OPTIONS(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();
  return deniedResponse ?? buildPublicApiOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

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
    return withPublicApiCors(request, NextResponse.json(
      {
        success: false,
        error: "Too many status checks. Please wait and try again.",
        summary: { pendingCount: 0, printingCount: 0, doneCount: 0 },
        jobs: [],
      },
      { status: 429 }
    ));
  }

  const storageSetupError = getStorageSetupError();

  if (batchParam && storageSetupError) {
    return withPublicApiCors(request, NextResponse.json(
      {
        success: false,
        error: storageSetupError,
        summary: { pendingCount: 0, printingCount: 0, doneCount: 0 },
        jobs: [],
      },
      { status: 503 }
    ));
  }

  const snapshot = await getQueueSnapshot();

  const resolveStatus = (relativePath: string, fallbackFilename?: string): StatusItem => {
    const activeJob = snapshot.activeJobsByPath.get(relativePath);

    if (activeJob) {
      const isPending = activeJob.metadata.status === "pending";
      const pendingIndex = snapshot.pendingPositions.get(activeJob.relativePath) ?? -1;

      return {
        relativePath,
        status: activeJob.metadata.status as StatusValue,
        queuePosition: isPending && pendingIndex >= 0 ? pendingIndex + 1 : null,
        queueAhead: isPending && pendingIndex >= 0 ? pendingIndex : null,
        filename: fallbackFilename ?? activeJob.filename,
        updatedAt: activeJob.timestamp,
      };
    }

    const doneJob = snapshot.doneJobsByPath.get(relativePath);

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
    const manifest = await getBatchManifest(batchParam);

    if (!manifest) {
      return withPublicApiCors(request, NextResponse.json(
        {
          success: false,
          error: "Batch not found",
          summary: { pendingCount: 0, printingCount: 0, doneCount: 0 },
          jobs: [],
        },
        { status: 404 }
      ));
    }

    const jobs = manifest.jobs.map((job) => resolveStatus(job.relativePath, job.filename));
    const summary = summarize(jobs);

    return withPublicApiCors(request, NextResponse.json({
      success: true,
      batch: {
        batchId: manifest.batchId,
        createdAt: manifest.createdAt,
        name: manifest.name,
      },
      summary,
      jobs,
    }));
  }

  const jobs = uniquePaths.map((relativePath) => resolveStatus(relativePath));
  const summary = {
    pendingCount: snapshot.pendingJobs.length,
    printingCount: snapshot.nowPrinting ? 1 : 0,
    doneCount: snapshot.doneJobs.length,
  };

  return withPublicApiCors(request, NextResponse.json({
    success: true,
    summary,
    jobs,
  }));
}
