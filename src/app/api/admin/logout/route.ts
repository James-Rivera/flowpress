import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { isSafeAdminReturnPath } from "@/lib/admin-route";
import { ensureBackendRoute } from "@/lib/role-guards";

export async function POST(request: NextRequest) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  const requestedReturnTo = request.nextUrl.searchParams.get("returnTo")?.trim() || "";
  const returnTo = isSafeAdminReturnPath(requestedReturnTo)
    ? requestedReturnTo
    : "/admin/login?notice=Logged+out";

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
