"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type QueueStatus = "pending" | "printing" | "done" | "missing";

type StatusJob = {
  relativePath: string;
  status: QueueStatus;
  queuePosition: number | null;
  queueAhead: number | null;
  filename?: string;
  updatedAt: number;
};

type QueueSummary = {
  pendingCount: number;
  printingCount: number;
  doneCount: number;
};

type RecentBatch = {
  batchId: string;
  createdAt: number;
  totalFiles: number;
  summary: QueueSummary;
};

function normalizeDisplayFilename(name: string) {
  const cleaned = name
    .replace(/^[0-9]+-B-[A-Z0-9-]+-[0-9]+-/, "")
    .replace(/_/g, " ")
    .trim();

  return cleaned || name;
}

function prettyStatus(status: QueueStatus) {
  if (status === "printing") return "Printing now";
  if (status === "pending") return "Waiting in queue";
  if (status === "done") return "Completed";
  return "Not found";
}

function statusClass(status: QueueStatus) {
  if (status === "done") {
    return "border-[#F4D400]/40 bg-[#fff9d6]";
  }

  if (status === "printing") {
    return "border-[#F4D400]/50 bg-[#fff4a3]";
  }

  if (status === "missing") {
    return "border-[#E53935]/30 bg-[#E53935]/10";
  }

  return "border-[#E5E7EB] bg-white";
}

export default function UploadTrackPage() {
  const searchParams = useSearchParams();
  const batchId = (searchParams.get("batch") ?? "").trim();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState<QueueSummary>({
    pendingCount: 0,
    printingCount: 0,
    doneCount: 0,
  });
  const [jobs, setJobs] = useState<StatusJob[]>([]);
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());

  const loadRecentBatchesForDevice = useCallback(async (activeBatchId: string) => {
    let batchIds: string[] = [];

    try {
      const parsed = JSON.parse(localStorage.getItem("cjnet_recent_batches") ?? "[]") as string[];
      batchIds = [activeBatchId, ...parsed].filter(Boolean);
      batchIds = Array.from(new Set(batchIds)).slice(0, 5);
    } catch {
      batchIds = activeBatchId ? [activeBatchId] : [];
    }

    const entries = await Promise.all(
      batchIds.map(async (id) => {
        try {
          const response = await fetch(`/api/upload/status?batch=${encodeURIComponent(id)}`, {
            cache: "no-store",
          });

          if (!response.ok) {
            return null;
          }

          const payload = (await response.json()) as {
            success: boolean;
            batch?: { batchId: string; createdAt: number };
            summary: QueueSummary;
            jobs: StatusJob[];
          };

          if (!payload.success || !payload.batch) {
            return null;
          }

          return {
            batchId: payload.batch.batchId,
            createdAt: payload.batch.createdAt,
            totalFiles: payload.jobs.length,
            summary: payload.summary,
          } satisfies RecentBatch;
        } catch {
          return null;
        }
      })
    );

    setRecentBatches(entries.filter((item): item is RecentBatch => item !== null));
  }, []);

  const shouldPoll = useMemo(
    () => jobs.some((job) => job.status === "pending" || job.status === "printing"),
    [jobs]
  );

  const loadStatus = useCallback(async () => {
    if (!batchId) {
      setIsLoading(false);
      setErrorMessage("Missing tracking reference. Please upload again.");
      return;
    }

    try {
      const response = await fetch(`/api/upload/status?batch=${encodeURIComponent(batchId)}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        batch?: { batchId: string; createdAt: number; name: string };
        summary: QueueSummary;
        jobs: StatusJob[];
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to load queue progress.");
      }

      setSummary(payload.summary);
      setJobs(payload.jobs);
      setLastUpdatedAt(Date.now());
      setErrorMessage("");

      await loadRecentBatchesForDevice(batchId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load queue progress.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, loadRecentBatchesForDevice]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const id = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => clearInterval(id);
  }, [shouldPoll, loadStatus]);

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto w-full max-w-2xl space-y-4">
        <header className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="h-1.5 w-full bg-[#F4D400]" />
          <div className="p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#F7F7F8] px-3 py-1 text-xs font-semibold text-[#111827]">
              <span className="h-2 w-2 rounded-full bg-[#E53935]" />
              Show this page to staff if needed
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Queue Status
            </h1>
            <p className="mt-2 text-sm text-[#6B7280]">Reference: {batchId || "-"}</p>
            <p className="mt-1 inline-flex items-center gap-2 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#F4D400]" />
              Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}
            </p>

            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] px-3 py-2 text-[#6B7280]">
                1. Upload received
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] px-3 py-2 text-[#6B7280]">
                2. Waiting in queue
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] px-3 py-2 text-[#6B7280]">
                3. Staff confirms print
              </div>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-[#E53935]/30 bg-[#E53935]/10 px-4 py-3 text-sm text-[#111827]">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-[#111827]">Your batch progress</h2>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] p-3">
              <p className="text-xs text-[#6B7280]">Pending</p>
              <p className="text-lg font-semibold text-[#111827]">{summary.pendingCount}</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#fff9d6] p-3">
              <p className="text-xs text-[#6B7280]">Printing</p>
              <p className="text-lg font-semibold text-[#111827]">{summary.printingCount}</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
              <p className="text-xs text-[#6B7280]">Done</p>
              <p className="text-lg font-semibold text-[#111827]">{summary.doneCount}</p>
            </div>
          </div>

          {isLoading ? <p className="mt-4 text-sm text-[#6B7280]">Loading queue status...</p> : null}

          <div className="mt-4 space-y-2">
            {jobs.map((job) => (
              <article
                key={job.relativePath}
                className={`rounded-xl border px-3 py-3 ${statusClass(job.status)}`}
              >
                <p className="truncate text-sm font-semibold text-[#111827]" title={job.filename ?? job.relativePath}>
                  {normalizeDisplayFilename(job.filename ?? job.relativePath)}
                </p>
                <p className="mt-1 text-xs text-[#6B7280]">Status: {prettyStatus(job.status)}</p>
                {job.status === "pending" && job.queuePosition ? (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Queue position: {job.queuePosition}
                    {typeof job.queueAhead === "number" ? ` (${job.queueAhead} ahead)` : ""}
                  </p>
                ) : null}
                {job.status === "pending" && typeof job.queueAhead === "number" ? (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Estimated wait: about {Math.max(1, job.queueAhead)} job(s) before this file.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-[#111827]">What happens next?</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Staff handles jobs in order. Printing starts only after manual confirmation at the shop.
          </p>
        </section>

        {recentBatches.length > 0 ? (
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#111827]">Recent uploads</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Open one of your recent upload batches.</p>

            <div className="mt-3 space-y-2">
              {recentBatches.map((batch) => (
                <Link
                  key={batch.batchId}
                  href={`/upload/track?batch=${encodeURIComponent(batch.batchId)}`}
                  className="block rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 hover:bg-[#F7F7F8]"
                >
                  <p className="text-sm font-semibold text-[#111827]">{batch.batchId}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    {batch.totalFiles} file(s) • {new Date(batch.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Pending {batch.summary.pendingCount} • Printing {batch.summary.printingCount} • Done {batch.summary.doneCount}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/upload"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#F4D400] px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
          >
            Upload More Files
          </Link>
          <button
            type="button"
            onClick={() => {
              void loadStatus();
            }}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
          >
            Refresh Status
          </button>
          <Link
            href="/"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
