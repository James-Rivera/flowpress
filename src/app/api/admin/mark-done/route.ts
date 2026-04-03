import { NextRequest } from "next/server";
import { ensureAdminRequestAuthenticated, redirectWithAdminNotice } from "@/lib/admin-route";
import {
  getUploadJob,
  moveUploadJobToDone,
  promoteNextPendingJobToPrinting,
  sanitizeJobPath,
} from "@/lib/print-jobs";
import { ensureBackendRoute } from "@/lib/role-guards";

export async function POST(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  const unauthenticatedResponse = ensureAdminRequestAuthenticated(request);

  if (unauthenticatedResponse) {
    return unauthenticatedResponse;
  }

  const formData = await request.formData();
  const rawJobPath = formData.get("jobPath") ?? formData.get("filename");
  const jobPath = typeof rawJobPath === "string" ? sanitizeJobPath(rawJobPath) : "";
  const returnTo = typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : "/admin";
  const autoAdvanceRaw = formData.get("autoAdvance");
  const autoAdvanceEnabled =
    typeof autoAdvanceRaw === "string"
      ? autoAdvanceRaw.toLowerCase() !== "off"
      : true;

  if (!jobPath) {
    return redirectWithAdminNotice(request, returnTo, "Missing job path", "error");
  }

  const job = await getUploadJob(jobPath);

  if (!job || job.metadata.status !== "printing") {
    return redirectWithAdminNotice(
      request,
      returnTo,
      "Only printing jobs can be marked done",
      "error"
    );
  }

  const moved = await moveUploadJobToDone(jobPath, "printing");

  if (!moved) {
    return redirectWithAdminNotice(request, returnTo, "Failed to complete job", "error");
  }

  if (!autoAdvanceEnabled) {
    return redirectWithAdminNotice(request, returnTo, "Job marked done", "success");
  }

  const promotedJobPath = await promoteNextPendingJobToPrinting();

  if (promotedJobPath) {
    return redirectWithAdminNotice(
      request,
      returnTo,
      "Job marked done. Next pending job is now printing.",
      "success"
    );
  }

  return redirectWithAdminNotice(request, returnTo, "Job marked done", "success");
}
