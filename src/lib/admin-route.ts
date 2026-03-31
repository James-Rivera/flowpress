import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";

export function isSafeAdminReturnPath(value: string) {
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

export function redirectWithAdminNotice(
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

export function redirectToAdminLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export function ensureAdminRequestAuthenticated(request: NextRequest) {
  return isAdminRequestAuthenticated(request) ? null : redirectToAdminLogin(request);
}
