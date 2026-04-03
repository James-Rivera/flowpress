const DEFAULT_LOCAL_HELPER_PROTOCOL = "cjnet-print";

export function getShopMirrorRelativePath(relativePath: string) {
  const normalized = relativePath.replace(/^\/+/, "");
  return normalized.startsWith("done/") ? normalized : `active/${normalized}`;
}

export function getShopHelperProtocol() {
  const protocol = (process.env.NEXT_PUBLIC_SHOP_HELPER_PROTOCOL ??
    process.env.SHOP_HELPER_PROTOCOL ??
    DEFAULT_LOCAL_HELPER_PROTOCOL)
    .trim()
    .replace(/:$/, "");

  return protocol || DEFAULT_LOCAL_HELPER_PROTOCOL;
}

export function buildShopLaunchUrl(relativePath: string, action: "open" | "print") {
  const params = new URLSearchParams({
    path: getShopMirrorRelativePath(relativePath),
    action,
  });

  return `${getShopHelperProtocol()}://launch?${params.toString()}`;
}
