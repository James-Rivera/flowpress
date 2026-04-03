import type { ReactNode } from "react";
import { ensureBackendPage } from "@/lib/role-guards";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  ensureBackendPage();
  return children;
}
