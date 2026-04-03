import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "cjnet_staff_session";

const DEFAULT_ADMIN_USERNAME = "staff";
const DEFAULT_ADMIN_PASSWORD = "cjnet123";
const DEFAULT_ADMIN_SESSION_SECRET = "cjnet-dev-staff-session-secret";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  nonce: string;
  expiresAt: number;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getConfigValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (trimmed) {
    return trimmed;
  }

  return isProduction() ? "" : fallback;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function getAdminSessionSecret() {
  return getConfigValue(process.env.ADMIN_SESSION_SECRET, DEFAULT_ADMIN_SESSION_SECRET);
}

function getSessionExpiry() {
  return Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
}

export function getAdminUsername() {
  return getConfigValue(process.env.ADMIN_USERNAME, DEFAULT_ADMIN_USERNAME);
}

export function getAdminPassword() {
  return getConfigValue(process.env.ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
}

export function getAdminSessionMaxAge() {
  return ADMIN_SESSION_TTL_SECONDS;
}

export function shouldUseSecureAdminCookie(request: Pick<NextRequest, "nextUrl" | "headers">) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const explicitHttps = request.nextUrl.protocol === "https:";

  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return explicitHttps;
}

export function getAdminAuthConfigurationError() {
  if (getAdminUsername() && getAdminPassword() && getAdminSessionSecret()) {
    return null;
  }

  return "Admin auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.";
}

export function isValidStaffLogin(username: string, password: string) {
  if (getAdminAuthConfigurationError()) {
    return false;
  }

  return username === getAdminUsername() && password === getAdminPassword();
}

export function createAdminSessionToken() {
  const secret = getAdminSessionSecret();

  if (!secret) {
    return "";
  }

  const payload: AdminSessionPayload = {
    nonce: randomBytes(16).toString("hex"),
    expiresAt: getSessionExpiry(),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function isAdminSessionCookieValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  const secret = getAdminSessionSecret();

  if (!secret) {
    return false;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const provided = Buffer.from(signature, "utf-8");
  const expected = Buffer.from(expectedSignature, "utf-8");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<AdminSessionPayload>;
    return typeof payload.expiresAt === "number" && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function isAdminRequestAuthenticated(request: NextRequest) {
  return isAdminSessionCookieValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}
