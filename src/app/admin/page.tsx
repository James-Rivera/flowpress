import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ConfirmActionForm from "@/app/admin/_components/confirm-action-form";
import PreviewPanel from "@/app/admin/_components/preview-panel";
import { ADMIN_SESSION_COOKIE, getAdminSessionToken } from "@/lib/admin-auth";
import { listDoneJobs, listUploadJobs, type PrintJob } from "@/lib/print-jobs";

export const dynamic = "force-dynamic";

type AdminSearchParams = {
  view?: string;
  folder?: string;
  preview?: string;
  notice?: string;
  tone?: string;
};

function formatTimestamp(value: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString();
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function getJobFolder(relativePath: string) {
  const clean = relativePath.replace(/^done\//, "");
  const index = clean.lastIndexOf("/");

  return index === -1 ? "General" : clean.slice(0, index);
}

function buildPreviewHref(
  view: "queue" | "done",
  relativePath: string
) {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("preview", relativePath);

  return `/admin?${params.toString()}`;
}

function buildPrintTabHref(relativePath: string) {
  const params = new URLSearchParams();
  params.set("path", relativePath);
  return `/admin/print?${params.toString()}`;
}

function getFileKind(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image";
  if (["txt", "md", "csv", "json", "log"].includes(extension)) return "text";
  return "other";
}

function encodePathSegments(relativePath: string) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPreferredPrintHref(relativePath: string, fileName: string) {
  const fileKind = getFileKind(fileName);

  if (fileKind === "image" || fileKind === "pdf") {
    return `/api/uploads/${encodePathSegments(relativePath)}`;
  }

  return buildPrintTabHref(relativePath);
}

function buildReturnTo(
  view: "queue" | "done",
  preview?: string
) {
  const params = new URLSearchParams();
  params.set("view", view);

  if (preview) {
    params.set("preview", preview);
  }

  return `/admin?${params.toString()}`;
}

function getToastStyle(tone: string) {
  if (tone === "error") {
    return "border-[#E53935]/30 bg-[#E53935]/10 text-[#111827]";
  }

  return "border-[#F4D400]/40 bg-[#fff9d6] text-[#111827]";
}

function QueueItem({
  job,
  returnTo,
}: {
  job: PrintJob;
  returnTo: string;
}) {
  return (
    <article className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111827]">{job.metadata.name || "Unnamed job"}</p>
          <p className="mt-1 text-xs text-[#6B7280]">{job.filename}</p>
          <p className="mt-2 text-sm text-[#111827]">
            {job.metadata.size || "-"} • {job.metadata.copies || "-"} copies • {job.metadata.color || "-"}
          </p>
          <p className="mt-1 text-xs text-[#6B7280]">Submitted {formatTimestamp(job.timestamp)}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={buildPreviewHref("queue", job.relativePath)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F7F7F8]"
          >
            Preview
          </Link>
          <ConfirmActionForm
            action="/api/admin/start-printing"
            jobPath={job.relativePath}
            returnTo={returnTo}
            confirmMessage="Confirm start printing this job now?"
            buttonLabel="Start Printing"
            buttonClassName="rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
          />
        </div>
      </div>
    </article>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (sessionCookie !== getAdminSessionToken()) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const view = getSearchParam(params.view) === "done" ? "done" : "queue";
  const selectedPreview = getSearchParam(params.preview);
  const notice = getSearchParam(params.notice);
  const tone = getSearchParam(params.tone);

  const [activeJobs, doneJobs] = await Promise.all([listUploadJobs(), listDoneJobs()]);

  const nowPrinting = activeJobs.find((job) => job.metadata.status === "printing") ?? null;
  const pendingJobs = activeJobs.filter((job) => job.metadata.status === "pending");

  const previewPool = view === "done" ? doneJobs : [...activeJobs, ...doneJobs];
  const previewJob = previewPool.find((job) => job.relativePath === selectedPreview) ?? nowPrinting;

  const queueReturnTo = buildReturnTo("queue", previewJob?.relativePath);
  const doneReturnTo = buildReturnTo("done", previewJob?.relativePath);

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-6 lg:px-8">
      {notice ? (
        <div className="pointer-events-none fixed right-5 top-5 z-50">
          <div
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${getToastStyle(tone)}`}
          >
            {notice}
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-[1400px] space-y-5">
        <header className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">CJ NET Print Ops</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Process print jobs in order, track active work, and update status without losing queue flow.
          </p>
          <div className="mt-4 flex gap-2 sm:gap-3">
          <Link
            href={`/admin?view=queue${selectedPreview ? `&preview=${encodeURIComponent(selectedPreview)}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              view === "queue"
                ? "border-b-2 border-[#F4D400] bg-transparent text-[#111827]"
                : "border-b-2 border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Pending
          </Link>
          <Link
            href={`/admin?view=done${selectedPreview ? `&preview=${encodeURIComponent(selectedPreview)}` : ""}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              view === "done"
                ? "border-b-2 border-[#F4D400] bg-transparent text-[#111827]"
                : "border-b-2 border-transparent text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Done
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] p-3">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-[#111827]">{pendingJobs.length}</p>
          </div>
          <div className="rounded-xl border border-[#F4D400]/40 bg-[#fff9d6] p-3">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Printing</p>
            <p className="mt-1 text-2xl font-semibold text-[#111827]">{nowPrinting ? 1 : 0}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Done Archive</p>
            <p className="mt-1 text-2xl font-semibold text-[#111827]">{doneJobs.length}</p>
          </div>
        </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          {view === "queue" ? (
            <section className="space-y-5">
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#111827]">Now Printing</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Current active job for staff focus.</p>

                {nowPrinting ? (
                  <article className="mt-4 rounded-2xl border border-[#F4D400]/40 bg-[#fff9d6] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="rounded-full bg-[#F4D400] px-3 py-1 text-xs font-semibold text-[#111827]">Printing</p>
                      <Link
                        href={buildPreviewHref("queue", nowPrinting.relativePath)}
                        className="text-sm font-medium text-[#111827] underline-offset-2 hover:underline"
                      >
                        Open Preview
                      </Link>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-[#111827]">{nowPrinting.metadata.name || "Unnamed job"}</h3>
                    <p className="text-sm text-[#6B7280]">{nowPrinting.filename}</p>
                    <p className="mt-2 text-xs text-[#6B7280]">Folder: {getJobFolder(nowPrinting.relativePath)}</p>
                    <p className="mt-3 text-sm text-[#111827]">
                      {nowPrinting.metadata.size || "-"} • {nowPrinting.metadata.copies || "-"} copies • {nowPrinting.metadata.color || "-"}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Link
                        href={buildPreferredPrintHref(
                          nowPrinting.relativePath,
                          nowPrinting.filename
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
                      >
                        Print
                      </Link>

                      <ConfirmActionForm
                        action="/api/admin/mark-done"
                        jobPath={nowPrinting.relativePath}
                        returnTo={queueReturnTo}
                        confirmMessage="Confirm this job has finished printing and should be marked done?"
                        buttonLabel="Done Printing"
                        buttonClassName="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
                      />

                      <ConfirmActionForm
                        action="/api/admin/return-pending"
                        jobPath={nowPrinting.relativePath}
                        returnTo={queueReturnTo}
                        confirmMessage="Return this job to pending queue?"
                        buttonLabel="Cancel Print"
                        buttonClassName="rounded-xl border border-[#E53935]/40 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#E53935]/10"
                      />
                    </div>
                  </article>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
                    No active print job. Start one from the pending list.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#111827]">Pending Queue</h2>
                <p className="mt-1 text-sm text-[#6B7280]">All jobs waiting to start printing.</p>

                {pendingJobs.length === 0 ? (
                  <p className="mt-4 text-sm text-[#6B7280]">No jobs in queue.</p>
                ) : (
                  <div className="mt-4 max-h-[600px] space-y-3 overflow-y-auto pr-1">
                    {pendingJobs.map((job) => (
                      <QueueItem
                        key={job.relativePath}
                        job={job}
                        returnTo={queueReturnTo}
                      />
                    ))}
                  </div>
                )}
              </section>
            </section>
          ) : (
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#111827]">Done Archive</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Completed jobs stored in uploads/done.</p>

              {doneJobs.length === 0 ? (
                <p className="mt-4 text-sm text-[#6B7280]">No completed jobs yet.</p>
              ) : (
                <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
                  {doneJobs
                    .slice()
                    .reverse()
                    .map((job) => (
                      <article key={job.relativePath} className="rounded-xl border border-[#E5E7EB] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[#111827]">{job.metadata.name || "Unnamed job"}</p>
                            <p className="mt-1 text-xs text-[#6B7280]">{job.filename}</p>
                            <p className="mt-2 text-sm text-[#111827]">
                              {job.metadata.size || "-"} • {job.metadata.copies || "-"} copies • {job.metadata.color || "-"}
                            </p>
                            <p className="mt-1 text-xs text-[#6B7280]">Completed {formatTimestamp(job.timestamp)}</p>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Link
                              href={buildPreviewHref("done", job.relativePath)}
                              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F7F7F8]"
                            >
                              Preview
                            </Link>
                            <ConfirmActionForm
                              action="/api/admin/return-pending"
                              jobPath={job.relativePath.replace(/^done\//, "")}
                              returnTo={doneReturnTo}
                              confirmMessage="Restore this completed job back to pending queue?"
                              buttonLabel="Restore"
                              buttonClassName="rounded-xl border border-[#E53935]/40 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#E53935]/10"
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>
          )}

          {previewJob ? (
            <PreviewPanel
              title={previewJob.filename}
              relativePath={previewJob.relativePath}
            />
          ) : (
            <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280] shadow-sm">
              Select a job, then open Preview to view and print from this dashboard.
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
