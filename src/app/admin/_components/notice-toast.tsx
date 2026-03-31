"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NoticeToastProps = {
  notice: string;
  tone: string;
  dismissAfterMs?: number;
};

function getToastStyle(tone: string) {
  if (tone === "error") {
    return "border-[#E53935]/30 bg-[#E53935]/10 text-[#111827]";
  }

  return "border-[#F4D400]/40 bg-[#fff9d6] text-[#111827]";
}

export default function NoticeToast({
  notice,
  tone,
  dismissAfterMs = 1500,
}: NoticeToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(false);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("notice");
      nextParams.delete("tone");
      const queryString = nextParams.toString();

      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    }, dismissAfterMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissAfterMs, notice, pathname, router, searchParams]);

  if (!isVisible || !notice) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50">
      <div
        className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${getToastStyle(tone)}`}
      >
        {notice}
      </div>
    </div>
  );
}
