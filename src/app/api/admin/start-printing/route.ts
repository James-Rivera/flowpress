import { NextRequest } from "next/server";
import { ensureAdminRequestAuthenticated, redirectWithAdminNotice } from "@/lib/admin-route";
import {
  getUploadJob,
  hasOtherPrintingJob,
  sanitizeJobPath,
  setUploadJobStatusWithTransitions,
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

  if (!jobPath) {
    return redirectWithAdminNotice(request, returnTo, "Missing job path", "error");
  }

  const targetJob = await getUploadJob(jobPath);

  if (!targetJob || targetJob.metadata.status !== "pending") {
    return redirectWithAdminNotice(
      request,
      returnTo,
      "Only pending jobs can start printing",
      "error"
    );
  }

  const hasAnotherPrinting = await hasOtherPrintingJob(jobPath);

  if (hasAnotherPrinting) {
    return redirectWithAdminNotice(
      request,
      returnTo,
      "Another job is already printing",
      "error"
    );
  }

  const updated = await setUploadJobStatusWithTransitions(jobPath, "printing", ["pending"]);

  if (!updated) {
    return redirectWithAdminNotice(
      request,
      returnTo,
      "Job status changed before update. Please refresh and try again.",
      "error"
    );
  }

  return redirectWithAdminNotice(request, returnTo, "Job moved to printing", "success");
}
