import { NextRequest } from "next/server";
import { ensureAdminRequestAuthenticated, redirectWithAdminNotice } from "@/lib/admin-route";
import {
  moveDoneJobToPending,
  sanitizeJobPath,
  setUploadJobStatus,
} from "@/lib/print-jobs";

export async function POST(request: NextRequest) {
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

  const updatedInUploads = await setUploadJobStatus(jobPath, "pending");

  if (updatedInUploads) {
    return redirectWithAdminNotice(request, returnTo, "Job returned to pending", "success");
  }

  const moved = await moveDoneJobToPending(jobPath);

  if (!moved) {
    return redirectWithAdminNotice(request, returnTo, "Failed to return job", "error");
  }

  return redirectWithAdminNotice(request, returnTo, "Job restored to pending", "success");
}
