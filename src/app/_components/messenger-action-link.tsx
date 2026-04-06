"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback } from "react";

type Props = {
  hrefWeb: string;
  hrefApp: string;
  className?: string;
  children: ReactNode;
};

function isMobileUserAgent(userAgent: string) {
  return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent);
}

export function MessengerActionLink({ hrefWeb, hrefApp, className, children }: Props) {
  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const userAgent = navigator.userAgent ?? "";
      const isMobile = isMobileUserAgent(userAgent);

      if (!isMobile) {
        return;
      }

      event.preventDefault();

      let fallbackTimer = 0;

      const cancelOnHidden = () => {
        if (!document.hidden) {
          return;
        }

        window.clearTimeout(fallbackTimer);
        document.removeEventListener("visibilitychange", cancelOnHidden);
      };

      document.addEventListener("visibilitychange", cancelOnHidden);

      fallbackTimer = window.setTimeout(() => {
        document.removeEventListener("visibilitychange", cancelOnHidden);
        window.location.assign(hrefWeb);
      }, 800);

      window.location.assign(hrefApp);
    },
    [hrefApp, hrefWeb]
  );

  const desktopTarget = "_blank";

  return (
    <a
      href={hrefWeb}
      onClick={onClick}
      target={desktopTarget}
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
