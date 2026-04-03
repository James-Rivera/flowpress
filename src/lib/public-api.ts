const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "").trim().replace(/\/+$/, "");

export function getPublicApiUrl(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return backendBaseUrl ? `${backendBaseUrl}${normalized}` : normalized;
}
