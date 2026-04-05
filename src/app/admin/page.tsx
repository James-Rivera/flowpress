import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ConfirmActionForm from "@/app/admin/_components/confirm-action-form";
import LiveAutoRefresh from "@/app/admin/_components/live-auto-refresh";
import NoticeToast from "@/app/admin/_components/notice-toast";
import PreviewPanel from "@/app/admin/_components/preview-panel";
import { ADMIN_SESSION_COOKIE, isAdminSessionCookieValue } from "@/lib/admin-auth";
import { encodePathSegments, getFileKind } from "@/lib/file-types";
import { type PrintJob } from "@/lib/print-jobs";
import { getQueueSnapshot } from "@/lib/print-job-service";
import { ensureBackendPage } from "@/lib/role-guards";
import { buildShopLaunchUrl } from "@/lib/shop-launch";

export const dynamic = "force-dynamic";

type AdminSearchParams = {
  view?: string;
  preview?: string;
  autoAdvance?: string;
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

function formatJobMeta(job: PrintJob) {
  return [
    job.metadata.size || "-",
    `${job.metadata.copies || "-"} copies`,
    job.metadata.color || "-",
  ].join(" / ");
}

function buildPreviewHref(
  view: "queue" | "done",
  relativePath: string,
  autoAdvanceEnabled: boolean
) {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("preview", relativePath);

  if (!autoAdvanceEnabled) {
    params.set("autoAdvance", "off");
  }

  return `/admin?${params.toString()}`;
}

function buildViewHref(
  view: "queue" | "done",
  preview: string,
  autoAdvanceEnabled: boolean
) {
  const params = new URLSearchParams();
  params.set("view", view);

  if (preview) {
    params.set("preview", preview);
  }

  if (!autoAdvanceEnabled) {
    params.set("autoAdvance", "off");
  }

  return `/admin?${params.toString()}`;
}

function buildPrintTabHref(relativePath: string) {
  const params = new URLSearchParams();
  params.set("path", relativePath);
  return `/admin/print?${params.toString()}`;
}

function buildReturnTo(
  view: "queue" | "done",
  preview: string | undefined,
  autoAdvanceEnabled: boolean
) {
  const params = new URLSearchParams();
  params.set("view", view);

  if (preview) {
    params.set("preview", preview);
  }

  if (!autoAdvanceEnabled) {
    params.set("autoAdvance", "off");
  }

  return `/admin?${params.toString()}`;
}

function QueueItem({
  job,
  returnTo,
  autoAdvanceEnabled,
}: {
  job: PrintJob;
  returnTo: string;
  autoAdvanceEnabled: boolean;
}) {
  return (
    <article className="rounded-[1rem] border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111827]">{job.metadata.name || "Unnamed job"}</p>
          <p className="mt-1 text-xs text-[#6B7280]">{job.filename}</p>
          <p className="mt-2 text-sm text-[#111827]">{formatJobMeta(job)}</p>
          <p className="mt-1 text-xs text-[#6B7280]">Submitted {formatTimestamp(job.timestamp)}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={buildPreviewHref("queue", job.relativePath, autoAdvanceEnabled)}
            className="secondary-btn !px-4 !py-2 !text-sm !font-medium"
          >
            Preview
          </Link>
          <ConfirmActionForm
            action="/api/admin/start-printing"
            jobPath={job.relativePath}
            returnTo={returnTo}
            buttonLabel="Start Printing"
            buttonClassName="primary-btn !px-4 !py-2 !text-sm"
          />
        </div>
      </div>
    </article>
  );
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M4 12h10" strokeLinecap="round" />
      <path d="M4 17h12" strokeLinecap="round" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="4" y="5" width="16" height="4" rx="1.5" />
      <path d="M6 9v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" strokeLinecap="round" />
    </svg>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[#fff9d6] text-[#111827]"
          : "text-[#5F6778] hover:bg-[#F9FAFB] hover:text-[#111827]"
      }`}
    >
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
          active ? "bg-[#F4D400]/35 text-[#111827]" : "bg-[#F3F4F6] text-[#5F6778]"
        }`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  ensureBackendPage();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!isAdminSessionCookieValue(sessionCookie)) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const view = getSearchParam(params.view) === "done" ? "done" : "queue";
  const selectedPreview = getSearchParam(params.preview);
  const autoAdvanceEnabled = getSearchParam(params.autoAdvance) !== "off";
  const notice = getSearchParam(params.notice);
  const tone = getSearchParam(params.tone);

  const snapshot = await getQueueSnapshot();
  const { doneJobs, pendingJobs, nowPrinting } = snapshot;

  const previewJob =
    (view === "done"
      ? snapshot.doneJobsByPath.get(selectedPreview)
      : snapshot.activeJobsByPath.get(selectedPreview) ?? snapshot.doneJobsByPath.get(selectedPreview)) ??
    nowPrinting;

  const queueReturnTo = buildReturnTo("queue", previewJob?.relativePath, autoAdvanceEnabled);
  const doneReturnTo = buildReturnTo("done", previewJob?.relativePath, autoAdvanceEnabled);

  return (
    <main className="app-shell">
      <LiveAutoRefresh />
      {notice ? <NoticeToast notice={notice} tone={tone} /> : null}

      <section className="page-wrap admin-wrap">
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_380px]">
          <aside className="self-start rounded-[1.75rem] border border-[#E5E7EB] bg-white p-5 shadow-[0_6px_18px_rgba(20,23,31,0.05)] xl:sticky xl:top-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">CJ NET</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">Print Ops</h1>
              </div>
              <form action="/api/admin/logout?returnTo=/admin/login" method="post">
                <button type="submit" className="secondary-btn !px-3 !py-2 !text-xs">
                  Log Out
                </button>
              </form>
            </div>

            <div className="mt-6 space-y-1">
              <NavItem
                href={buildViewHref("queue", selectedPreview, autoAdvanceEnabled)}
                label="Pending queue"
                active={view === "queue"}
                icon={<QueueIcon />}
              />
              <NavItem
                href={buildViewHref("done", selectedPreview, autoAdvanceEnabled)}
                label="Done archive"
                active={view === "done"}
                icon={<ArchiveIcon />}
              />
            </div>

            <div className="mt-6 rounded-[1.25rem] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">Auto-advance</p>
              <div className="mt-3 flex items-center gap-2 rounded-[0.9rem] border border-[#E5E7EB] bg-white p-1">
                <Link
                  href={buildViewHref(view, selectedPreview, true)}
                  className={`flex-1 rounded-[0.7rem] px-3 py-2 text-center text-xs font-semibold ${
                    autoAdvanceEnabled
                      ? "bg-[#F4D400] text-[#111827]"
                      : "text-[#5F6778] hover:bg-[#F9FAFB]"
                  }`}
                >
                  On
                </Link>
                <Link
                  href={buildViewHref(view, selectedPreview, false)}
                  className={`flex-1 rounded-[0.7rem] px-3 py-2 text-center text-xs font-semibold ${
                    !autoAdvanceEnabled
                      ? "bg-[#111827] text-white"
                      : "text-[#5F6778] hover:bg-[#F9FAFB]"
                  }`}
                >
                  Off
                </Link>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-[1.25rem] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">Pending</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">{pendingJobs.length}</p>
              </div>
              <div className="rounded-[1.25rem] border border-[#F4D400]/35 bg-[#fff9d6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">Printing</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">{nowPrinting ? 1 : 0}</p>
              </div>
              <div className="rounded-[1.25rem] border border-[#E5E7EB] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">Done</p>
                <p className="mt-2 text-3xl font-semibold text-[#111827]">{doneJobs.length}</p>
              </div>
            </div>

            <p className="mt-6 rounded-[1.25rem] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
              Open Preview before printing so staff can verify the file and settings.
            </p>
          </aside>

          <div className="space-y-5">
            <header className="rounded-[1.75rem] border border-[#E5E7EB] bg-white p-6 shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6778]">Admin workspace</p>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-[#111827]">
                    {view === "queue" ? "Queue" : "Archive"}
                  </h2>
                  <p className="mt-2 text-sm text-[#6B7280]">
                    {view === "queue"
                      ? "Review the active job first, then move through the pending queue."
                      : "Review completed jobs and restore them if needed."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="status-pill status-pill-warm">Printing {nowPrinting ? 1 : 0}</span>
                  <span className="status-pill border border-[#E5E7EB] bg-white text-[#111827]">
                    Pending {pendingJobs.length}
                  </span>
                  <span className="status-pill border border-[#E5E7EB] bg-white text-[#111827]">
                    Done {doneJobs.length}
                  </span>
                </div>
              </div>
            </header>

          {view === "queue" ? (
            <section className="space-y-5">
              <section className="rounded-[1.75rem] border border-[#E5E7EB] bg-white p-6 shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
                <h2 className="text-xl font-semibold text-[#111827]">Now Printing</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Current active job for staff focus.</p>

                {nowPrinting ? (
                  <article className="mt-4 rounded-[1.5rem] border border-[#F4D400]/40 bg-[#fff9d6] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="rounded-full bg-[#F4D400] px-3 py-1 text-xs font-semibold text-[#111827]">Printing</p>
                      <Link
                        href={buildPreviewHref("queue", nowPrinting.relativePath, autoAdvanceEnabled)}
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
                      <a
                        href={buildShopLaunchUrl(nowPrinting.relativePath, "print")}
                        className="primary-btn !px-4 !py-2 !text-sm"
                      >
                        Print Local Copy
                      </a>
                      <a
                        href={buildShopLaunchUrl(nowPrinting.relativePath, "open")}
                        className="secondary-btn !px-4 !py-2 !text-sm"
                      >
                        Open Local File
                      </a>
                      <Link
                        href={getFileKind(nowPrinting.filename) === "image" || getFileKind(nowPrinting.filename) === "pdf"
                          ? `/api/uploads/${encodePathSegments(nowPrinting.relativePath)}`
                          : buildPrintTabHref(nowPrinting.relativePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-btn !px-4 !py-2 !text-sm"
                      >
                        Browser Fallback
                      </Link>

                      <ConfirmActionForm
                        action="/api/admin/mark-done"
                        jobPath={nowPrinting.relativePath}
                        returnTo={queueReturnTo}
                        hiddenFields={{ autoAdvance: autoAdvanceEnabled ? "on" : "off" }}
                        buttonLabel="Done Printing"
                        buttonClassName="secondary-btn !px-4 !py-2 !text-sm"
                      />

                      <ConfirmActionForm
                        action="/api/admin/return-pending"
                        jobPath={nowPrinting.relativePath}
                        returnTo={queueReturnTo}
                        confirmMessage="Return this job to pending queue?"
                        buttonLabel="Cancel Print"
                        buttonClassName="danger-btn !px-4 !py-2 !text-sm"
                      />
                    </div>
                  </article>
                ) : (
                  <p className="mt-4 rounded-[1rem] border border-dashed border-[#E5E7EB] p-4 text-sm text-[#6B7280]">
                    No active print job. Start one from the pending list.
                  </p>
                )}
              </section>

              <section className="rounded-[1.75rem] border border-[#E5E7EB] bg-white p-6 shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
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
                        autoAdvanceEnabled={autoAdvanceEnabled}
                      />
                    ))}
                  </div>
                )}
              </section>
            </section>
          ) : (
            <section className="rounded-[1.75rem] border border-[#E5E7EB] bg-white p-6 shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
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
                      <article key={job.relativePath} className="rounded-[1rem] border border-[#E5E7EB] p-4">
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
                              href={buildPreviewHref("done", job.relativePath, autoAdvanceEnabled)}
                              className="secondary-btn !px-4 !py-2 !text-sm !font-medium"
                            >
                              Preview
                            </Link>
                            <ConfirmActionForm
                              action="/api/admin/return-pending"
                              jobPath={job.relativePath.replace(/^done\//, "")}
                              returnTo={doneReturnTo}
                              confirmMessage="Restore this completed job back to pending queue?"
                              buttonLabel="Restore"
                              buttonClassName="danger-btn !px-4 !py-2 !text-sm"
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </section>
          )}
          </div>

          <div className="space-y-5">
            {previewJob ? (
              <PreviewPanel
                title={previewJob.filename}
                relativePath={previewJob.relativePath}
                openLocalUrl={buildShopLaunchUrl(previewJob.relativePath, "open")}
                printLocalUrl={buildShopLaunchUrl(previewJob.relativePath, "print")}
              />
            ) : (
              <aside className="rounded-[1.75rem] border border-[#E5E7EB] bg-white p-5 text-sm text-[#6B7280] shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
                Select a job, then open Preview to view and print from this dashboard.
              </aside>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
