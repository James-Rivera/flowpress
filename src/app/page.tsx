import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center shadow-sm sm:p-7">
        <span className="inline-flex rounded-full bg-[#F4D400]/20 px-3 py-1 text-xs font-semibold text-[#111827]">
          CJ NET Printing
        </span>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
          Fast File Submission
        </h1>
        <p className="mt-2 text-sm text-[#6B7280] sm:text-base">
          Send your print request in a few taps.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href="https://m.me/cjnetvalley"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#F4D400] px-4 py-3 text-base font-semibold text-[#111827] hover:bg-[#e3c400]"
          >
            Send via Messenger
          </a>

          <Link
            href="/upload"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-base font-semibold text-[#111827] hover:bg-[#F7F7F8]"
          >
            Upload File
          </Link>
        </div>

        <details className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] p-3 text-left">
          <summary className="cursor-pointer text-sm font-semibold text-[#111827]">Need help?</summary>
          <p className="mt-2 text-sm text-[#6B7280]">Show this page to staff and they will assist you.</p>
        </details>
      </section>
    </main>
  );
}
