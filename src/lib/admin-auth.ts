import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "cjnet_staff_session";

const DEFAULT_ADMIN_USERNAME = "staff";
const DEFAULT_ADMIN_PASSWORD = "cjnet123";
const DEFAULT_ADMIN_SESSION_TOKEN = "cjnet-staff-authenticated";

export function getAdminUsername() {
  return process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME;
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
}

export function getAdminSessionToken() {
  return process.env.ADMIN_SESSION_TOKEN ?? DEFAULT_ADMIN_SESSION_TOKEN;
}

export function isValidStaffLogin(username: string, password: string) {
  return username === getAdminUsername() && password === getAdminPassword();
}

export function isAdminRequestAuthenticated(request: NextRequest) {
  return request.cookies.get(ADMIN_SESSION_COOKIE)?.value === getAdminSessionToken();
}
