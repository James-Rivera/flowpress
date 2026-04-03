import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminAuthConfigurationError,
  getAdminSessionMaxAge,
  isValidStaffLogin,
} from "@/lib/admin-auth";
import { ensureBackendRoute } from "@/lib/role-guards";

export async function POST(request: Request) {
  const deniedResponse = ensureBackendRoute();

  if (deniedResponse) {
    return deniedResponse;
  }

  try {
    const configurationError = getAdminAuthConfigurationError();

    if (configurationError) {
      return NextResponse.json(
        { success: false, error: configurationError },
        { status: 503 }
      );
    }

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!isValidStaffLogin(username, password)) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: createAdminSessionToken(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAdminSessionMaxAge(),
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}
