import { NextRequest, NextResponse } from "next/server";
import {
  isAdminRequestAuthenticated,
} from "@/lib/admin-auth";
import { getUploadJob, moveUploadJobToDone, sanitizeJobPath } from "@/lib/print-jobs";

function isSafeAdminReturnPath(value: string) {
  if (!value || value.startsWith("//") || /[\r\n]/.test(value)) {
    return false;
  }

  if (!value.startsWith("/admin")) {
    return false;
  }

  try {
    const parsed = new URL(value, "http://localhost");
    return parsed.pathname.startsWith("/admin");
  } catch {
    return false;
  }
}

function redirectWithNotice(
  request: NextRequest,
  returnTo: string,
  notice: string,
  tone: "success" | "error"
) {
  const safePath = isSafeAdminReturnPath(returnTo) ? returnTo : "/admin";
  const url = new URL(safePath, request.url);
  url.searchParams.set("notice", notice);
  url.searchParams.set("tone", tone);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const formData = await request.formData();
  const rawJobPath = formData.get("jobPath") ?? formData.get("filename");
  const jobPath = typeof rawJobPath === "string" ? sanitizeJobPath(rawJobPath) : "";
  const returnTo = typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : "/admin";

  if (!jobPath) {
    return redirectWithNotice(request, returnTo, "Missing job path", "error");
  }

  const job = await getUploadJob(jobPath);

  if (!job || job.metadata.status !== "printing") {
    return redirectWithNotice(
      request,
      returnTo,
      "Only printing jobs can be marked done",
      "error"
    );
  }

  const moved = await moveUploadJobToDone(jobPath);

  if (!moved) {
    return redirectWithNotice(request, returnTo, "Failed to complete job", "error");
  }

  return redirectWithNotice(request, returnTo, "Job marked done", "success");
}
