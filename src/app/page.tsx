import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const gmailTo = "cjnetvalley@gmail.com";
  const gmailSubject = "CJ NET Print Request";
  const gmailBody = [
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

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    gmailTo
  )}&su=${encodeURIComponent(gmailSubject)}&body=${encodeURIComponent(gmailBody)}`;

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-6 sm:py-10">
      <section className="mx-auto w-full max-w-[460px] rounded-3xl border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_10px_24px_rgba(17,24,39,0.08)] sm:p-7">
        <div className="mx-auto mb-5 flex w-full max-w-[136px] items-center justify-center">
          <Image
            src="/logo.svg"
            alt="CJ NET shop logo"
            width={360}
            height={120}
            className="h-auto w-full"
            priority
          />
        </div>

        <h1 className="text-[2.15rem] font-bold tracking-tight text-[#111827] sm:text-[2.35rem]">
          Fast File Submission
        </h1>
        <p className="mt-3 text-[1.05rem] text-[#6B7280]">
          Send your print request in a few taps.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="https://m.me/cjnetvalley"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#F4D400] px-4 py-3.5 text-lg font-bold text-[#111827] transition-colors hover:bg-[#e3c400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
          >
            Send via Messenger
          </a>

          <Link
            href="/upload"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-4 py-3.5 text-lg font-semibold text-[#111827] transition-colors hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
          >
            Upload File
          </Link>

          <a
            href={gmailComposeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-4 py-3.5 text-lg font-semibold text-[#111827] transition-colors hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
          >
            Send via Gmail
          </a>

          <Link
            href="/send/bluetooth"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-4 py-3.5 text-lg font-semibold text-[#111827] transition-colors hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
          >
            Send via Bluetooth
          </Link>
        </div>

        <details className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8] p-3 text-left">
          <summary className="cursor-pointer text-sm font-semibold text-[#111827]">Need help?</summary>
          <p className="mt-2 text-sm text-[#6B7280]">
            Show this page to staff and they will assist you with Messenger, Upload, Gmail, or Bluetooth.
          </p>
        </details>
      </section>
    </main>
  );
}
