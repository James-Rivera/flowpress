import Image from "next/image";
import Link from "next/link";

import { EmailActionLink } from "@/app/_components/email-action-link";
import { buildGmailIOSAppComposeUrl, buildGmailWebComposeUrl, buildMailtoUrl } from "@/lib/email-links";

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
      <section className="mx-auto w-full max-w-[560px] rounded-[1.5rem] border border-[rgba(20,23,31,0.08)] bg-white p-5 shadow-[0_6px_18px_rgba(20,23,31,0.05)] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-[0.9rem] border border-[#E5E7EB] bg-white p-2">
            <Image src="/logo.svg" alt="CJ NET shop logo" width={64} height={64} className="h-full w-full" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#111827]">In-shop transfer</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">Use this when staff is helping you send a file from your phone.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1rem] border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <h2 className="text-sm font-semibold text-[#111827]">Android</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#111827]">
              <li>Turn on Bluetooth on your phone.</li>
              <li>Open the file, then tap Share.</li>
              <li>Select Bluetooth.</li>
              <li>Choose the CJ NET device. Ask staff for the device name if needed.</li>
              <li>Tap Send, then wait for staff to accept the file.</li>
            </ol>
          </div>

          <div className="rounded-[1rem] border border-[#E5E7EB] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#111827]">iPhone</h2>
            <p className="mt-2 text-sm text-[#111827]">
              iPhone usually uses <span className="font-semibold">AirDrop</span> for file sharing. Bluetooth transfer is
              limited on iOS, so ask staff to help you use AirDrop instead.
            </p>
            <p className="mt-2 text-sm text-[#6B7280]">If AirDrop is not available, use Upload File or Email.</p>
          </div>

          <div className="rounded-[1rem] border border-[#E5E7EB] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#111827]">If transfer is not working</h2>
            <p className="mt-2 text-sm text-[#6B7280]">Use one of these instead:</p>
            <div className="mt-3 flex flex-col gap-3">
              <Link href="/upload" className="primary-btn w-full">
                Upload File
              </Link>
              <EmailActionLink
                hrefWebDesktop={emailHrefDesktopWeb}
                hrefMailtoFallback={emailHrefMailtoFallback}
                hrefGmailAppIOS={emailHrefGmailAppIOS}
                className="secondary-btn w-full"
              >
                Send via Email
              </EmailActionLink>
              <Link href="/" className="ghost-btn w-full">
                Back to options
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
