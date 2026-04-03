import path from "node:path";

export type FileKind = "pdf" | "image" | "text" | "office" | "other";

export const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".docx",
]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log"]);
const OFFICE_EXTENSIONS = new Set([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function getFileKind(fileName: string): FileKind {
  const extension = getFileExtension(fileName);

  if (extension === ".pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (OFFICE_EXTENSIONS.has(extension)) return "office";

  return "other";
}

export function isPreviewSupported(fileName: string) {
  const kind = getFileKind(fileName);
  return kind === "pdf" || kind === "image" || kind === "text";
}

export function getMimeType(fileName: string) {
  const extension = getFileExtension(fileName);

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".txt" || extension === ".log") return "text/plain; charset=utf-8";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".csv") return "text/csv; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".xls") return "application/vnd.ms-excel";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".ppt") return "application/vnd.ms-powerpoint";
  if (extension === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  return "application/octet-stream";
}

export function encodePathSegments(relativePath: string) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getRelativePathFileName(relativePath: string) {
  const segments = relativePath.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : "file";
}

export function normalizeDisplayFilename(name: string) {
  const cleaned = name
    .replace(/^[0-9]+-B-[A-Z0-9-]+-[0-9]+-/, "")
    .replace(/_/g, " ")
    .trim();

  return cleaned || name;
}
