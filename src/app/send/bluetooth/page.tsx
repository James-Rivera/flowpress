import Image from "next/image";
import Link from "next/link";

import { EmailActionLink } from "@/app/_components/email-action-link";
import { buildGmailIOSAppComposeUrl, buildGmailWebComposeUrl, buildMailtoUrl } from "@/lib/email-links";

function StepDot() {
  return <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-text-secondary" aria-hidden="true" />;
}

function PlatformMiniIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4"
      aria-hidden="true"
    />
  );
}

export default function BluetoothSendGuidePage() {
  const emailBody = [
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

  const emailHrefDesktopWeb = buildGmailWebComposeUrl({
    to: "cjnetvalley@gmail.com",
    subject: "CJ NET Print Request",
    body: emailBody,
  });

  const emailHrefMailtoFallback = buildMailtoUrl({
    to: "cjnetvalley@gmail.com",
    subject: "CJ NET Print Request",
    body: emailBody,
  });

  const emailHrefGmailAppIOS = buildGmailIOSAppComposeUrl({
    to: "cjnetvalley@gmail.com",
    subject: "CJ NET Print Request",
    body: emailBody,
  });

  return (
    <main className="app-shell">
      <section className="page-wrap customer-wrap">
        <div className="mx-auto w-full max-w-[560px]">
          <header className="px-1">
            <h1 className="display-title text-2xl font-semibold tracking-tight text-foreground">In-shop transfer</h1>
            <p className="mt-1 text-sm font-medium text-text-secondary">Ask staff to help you send your file</p>
          </header>

          <section className="mt-4 rounded-[1.25rem] border border-surface-border bg-surface-card shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
            <div className="px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-foreground">
                <PlatformMiniIcon src="/icons/android.svg" />
                <span>Android</span>
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm font-medium text-foreground">
                <li className="flex items-start gap-2">
                  <StepDot />
                  <span>Turn on Bluetooth</span>
                </li>
                <li className="flex items-start gap-2">
                  <StepDot />
                  <span>Tap Share → Bluetooth</span>
                </li>
                <li className="flex items-start gap-2">
                  <StepDot />
                  <span>Select SERVER1 device</span>
                </li>
              </ul>
            </div>

            <div className="h-px w-full bg-surface-border" />

            <div className="px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-foreground">
                <PlatformMiniIcon src="/icons/apple.svg" />
                <span>iPhone</span>
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm font-medium text-foreground">
                <li className="flex items-start gap-2">
                  <StepDot />
                  <span>Use AirDrop</span>
                </li>
                <li className="flex items-start gap-2">
                  <StepDot />
                  <span>Ask staff if needed</span>
                </li>
              </ul>
            </div>

            <div className="h-px w-full bg-surface-border" />

            <div className="px-5 py-4 sm:px-6">
              <h2 className="text-sm font-extrabold tracking-wide text-foreground">Not working?</h2>
              <div className="mt-3 flex flex-col gap-3">
                <Link href="/upload" className="primary-btn w-full min-h-[56px] text-base">
                  Upload Files
                </Link>
                <EmailActionLink
                  hrefWebDesktop={emailHrefDesktopWeb}
                  hrefMailtoFallback={emailHrefMailtoFallback}
                  hrefGmailAppIOS={emailHrefGmailAppIOS}
                  className="secondary-btn w-full min-h-[56px] text-base"
                >
                  Send via Email
                </EmailActionLink>
                <Link href="/" className="ghost-btn w-full min-h-[56px] text-base">
                  Back
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
