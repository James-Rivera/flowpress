"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { encodePathSegments, getRelativePathFileName, isPreviewSupported } from "@/lib/file-types";

function AdminPrintPageContent() {
  const searchParams = useSearchParams();
  const [autoPrintAttempted, setAutoPrintAttempted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const relativePath = searchParams.get("path") ?? "";
  const fileName = getRelativePathFileName(relativePath);
  const encodedPath = encodePathSegments(relativePath);

  const canPreview = isPreviewSupported(fileName);
  const sourceUrl = `/api/uploads/${encodedPath}`;
  const downloadUrl = `/api/uploads/${encodedPath}?download=1`;

  const handlePrint = () => {
    if (!frameRef.current?.contentWindow) {
      return;
    }

    frameRef.current.contentWindow.focus();
    frameRef.current.contentWindow.print();
  };

  useEffect(() => {
    if (!canPreview || autoPrintAttempted) {
      return;
    }

    const timeout = setTimeout(() => {
      setAutoPrintAttempted(true);
      handlePrint();
    }, 450);

    return () => clearTimeout(timeout);
  }, [autoPrintAttempted, canPreview]);

  if (!relativePath) {
    return (
      <main className="min-h-screen bg-[#F7F7F8] p-4 sm:p-6">
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-[#F4D400]/20 px-3 py-1 text-xs font-semibold text-[#111827]">
            Printing
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">Print File</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            No file was selected for printing. Open a file from Admin and try again.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
          >
            Back to Admin
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F8] p-4 sm:p-6">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex rounded-full bg-[#F4D400]/20 px-3 py-1 text-xs font-semibold text-[#111827]">
              Ready to print
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Print Job</h1>
            <p className="text-sm text-[#6B7280]">{fileName}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#F4D400] px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#e3c400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2 sm:flex-none"
            >
              Print
            </button>
            <a
              href={downloadUrl}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8] sm:flex-none"
            >
              Download Copy
            </a>
          </div>
        </div>

        {canPreview ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB]">
            <iframe
              ref={frameRef}
              src={sourceUrl}
              title={fileName}
              className="h-[72vh] w-full bg-white sm:h-[76vh]"
            />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[#E53935]/30 bg-[#E53935]/10 p-4 text-sm text-[#111827]">
            <p className="font-medium text-[#111827]">Preview unavailable for this file type.</p>
            <p className="mt-1 text-[#6B7280]">
              Download the file and print it from your installed Office or document app.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function PrintPageFallback() {
  return (
    <main className="min-h-screen bg-[#F7F7F8] p-4 sm:p-6">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#6B7280] shadow-sm">
        Loading print preview...
      </section>
    </main>
  );
}

export default function AdminPrintPage() {
  return (
    <Suspense fallback={<PrintPageFallback />}>
      <AdminPrintPageContent />
    </Suspense>
  );
}
