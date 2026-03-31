"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type LiveAutoRefreshProps = {
  intervalMs?: number;
};

export default function LiveAutoRefresh({ intervalMs = 2500 }: LiveAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (!navigator.onLine) {
        return;
      }

      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, router]);

  return null;
}
