import Image from "next/image";
import Link from "next/link";

import { buildGmailAndroidIntentComposeUrl, buildGmailIOSAppComposeUrl, buildGmailWebComposeUrl, buildMailtoUrl } from "@/lib/email-links";
import { MessengerActionLink } from "@/app/_components/messenger-action-link";
import { EmailActionLink } from "@/app/_components/email-action-link";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 16V5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlatformIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={20}
      height={20}
      className="h-5 w-5"
      priority
    />
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-surface-border" />
      <div className="text-[11px] font-semibold tracking-wide text-text-secondary">{label}</div>
      <div className="h-px flex-1 bg-surface-border" />
    </div>
  );
}

export default function Home() {
  const messengerWebHref = "https://m.me/cjnetvalley";
  const messengerAppHref = "fb-messenger://user-thread/cjnetvalley";

  const to = "cjnetvalley@gmail.com";
  const subject = "CJ NET Print Request";
  const body = [
    "Hi CJ NET,",
    "",
    "Please print my file.",
    "",
    "Name:",
    "Paper size (A4 / Short / Long):",
    "Copies:",
    "Color (B&W / Color):",
    "Notes:",
    "",
    "Reminder: Please attach your file before sending.",
  ].join("\n");

  const emailHrefDesktopWeb = buildGmailWebComposeUrl({ to, subject, body });
  const emailHrefMailtoFallback = buildMailtoUrl({ to, subject, body });
  const emailHrefGmailAppIOS = buildGmailIOSAppComposeUrl({ to, subject, body });
  const emailHrefGmailAppAndroid = buildGmailAndroidIntentComposeUrl({ to, subject, body });

  return (
    <main className="app-shell flex items-center justify-center">
      <section className="page-wrap customer-wrap">
        <section className="mx-auto w-full max-w-[420px] rounded-[1.75rem] border border-surface-border bg-surface-card px-6 py-7 shadow-[0_10px_28px_rgba(20,23,31,0.10)] sm:px-8 sm:py-8">
          <div className="flex justify-center">
            <Link href="/" className="utility-logo-link w-full max-w-[180px]">
              <Image src="/logo.svg" alt="CJ NET shop logo" width={360} height={120} className="h-auto w-full" priority />
            </Link>
          </div>

          <p className="mt-6 text-center text-sm font-medium text-text-secondary">
            Choose a platform to send your file
          </p>

          <div className="mt-5">
            <Link
              href="/upload"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-yellow px-4 py-4 text-sm font-extrabold text-foreground shadow-[0_1px_0_rgba(0,0,0,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(244,212,0,0.30)]"
            >
              <UploadIcon />
              <span>Upload Files &gt; Shop</span>
            </Link>
          </div>

          <Divider label="Alternative Platforms" />

          <div className="mt-5 space-y-3">
            <EmailActionLink
              hrefWebDesktop={emailHrefDesktopWeb}
              hrefMailtoFallback={emailHrefMailtoFallback}
              hrefGmailAppIOS={emailHrefGmailAppIOS}
              hrefGmailAppAndroid={emailHrefGmailAppAndroid}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-surface-border bg-white px-4 py-4 text-sm font-bold text-foreground shadow-[0_1px_0_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(244,212,0,0.18)]"
            >
              <PlatformIcon src="/icons/gmail.svg" alt="Gmail" />
              <span>Gmail</span>
              <span className="sr-only">(opens compose)</span>
            </EmailActionLink>

            <MessengerActionLink
              hrefWeb={messengerWebHref}
              hrefApp={messengerAppHref}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-platform-messenger px-4 py-4 text-sm font-bold text-white shadow-[0_1px_0_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(24,119,242,0.25)]"
            >
              <span className="text-white" aria-hidden="true">
                <PlatformIcon src="/icons/messenger.svg" alt="" />
              </span>
              <span>Messenger</span>
            </MessengerActionLink>

            <Link
              href="/send/bluetooth"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-platform-bluetooth px-4 py-4 text-sm font-bold text-white shadow-[0_1px_0_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(33,150,243,0.25)]"
            >
              <span className="text-white" aria-hidden="true">
                <PlatformIcon src="/icons/bluetooth.svg" alt="" />
              </span>
              <span>Bluetooth</span>
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
