"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback } from "react";

type Props = {
  hrefWebDesktop: string;
  hrefMailtoFallback: string;
  hrefGmailAppIOS: string;
  className?: string;
  children: ReactNode;
};

function isIOSUserAgent(userAgent: string) {
  return /(iphone|ipad|ipod)/i.test(userAgent);
}

function isMobileUserAgent(userAgent: string) {
  return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent);
}

export function EmailActionLink({
  hrefWebDesktop,
  hrefMailtoFallback,
  hrefGmailAppIOS,
  className,
  children,
}: Props) {
  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const userAgent = navigator.userAgent ?? "";

      if (!isMobileUserAgent(userAgent)) {
        return;
      }

      if (!isIOSUserAgent(userAgent)) {
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
        window.location.assign(hrefMailtoFallback);
      }, 800);

      window.location.assign(hrefGmailAppIOS);
    },
    [hrefGmailAppIOS, hrefMailtoFallback]
  );

  return (
    <a
      href={hrefWebDesktop}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
