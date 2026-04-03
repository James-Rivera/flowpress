import path from "node:path";

export type AppRole = "frontend" | "backend";

const FALLBACK_BACKEND_ORIGIN = "";

function normalizeRole(value: string | undefined): AppRole {
  return value?.trim().toLowerCase() === "frontend" ? "frontend" : "backend";
}

export function getAppRole(): AppRole {
  return normalizeRole(process.env.APP_ROLE);
}

export function isFrontendRole() {
  return getAppRole() === "frontend";
}

export function isBackendRole() {
  return getAppRole() === "backend";
}

export function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? FALLBACK_BACKEND_ORIGIN).trim().replace(/\/+$/, "");
}

export function getPublicApiUrl(pathname: string) {
  const pathValue = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const baseUrl = getBackendBaseUrl();
  return baseUrl ? `${baseUrl}${pathValue}` : pathValue;
}

function isSubPath(parentPath: string, childPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function validateFilesystemStorageRoot(storageRoot: string) {
  const resolved = path.resolve(storageRoot);
  const forbiddenRoots = [path.resolve("/mnt/backup"), path.resolve("/mnt/backup/nextcloud")];
  const nextcloudRoot = forbiddenRoots[1];

  if (!storageRoot.trim()) {
    return "UPLOADS_DIR is required for backend filesystem storage.";
  }

  if (resolved === forbiddenRoots[0]) {
    return "UPLOADS_DIR must not be set to /mnt/backup.";
  }

  if (resolved === nextcloudRoot || isSubPath(nextcloudRoot, resolved)) {
    return "UPLOADS_DIR must not point to /mnt/backup/nextcloud or its children.";
  }

  return null;
}
