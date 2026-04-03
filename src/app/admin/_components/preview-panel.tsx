"use client";

import { encodePathSegments, getFileKind, isPreviewSupported } from "@/lib/file-types";

type PreviewPanelProps = {
  title: string;
  relativePath: string;
  openLocalUrl: string;
  printLocalUrl: string;
};

export default function PreviewPanel({
  title,
  relativePath,
  openLocalUrl,
  printLocalUrl,
}: PreviewPanelProps) {
  const kind = getFileKind(title);
  const encodedPath = encodePathSegments(relativePath);
  const sourceUrl = `/api/uploads/${encodedPath}`;
  const downloadUrl = `/api/uploads/${encodedPath}?download=1`;
  const printUrl = `/admin/print?path=${encodeURIComponent(relativePath)}`;
  const canPreview = isPreviewSupported(title);

  return (
    <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-[#111827]">Preview</h2>
      <p className="mt-1 text-xs text-[#6B7280]">{title}</p>
      <p className="mt-2 rounded-xl border border-[#E5E7EB] bg-[#F7F7F8] px-3 py-2 text-xs text-[#6B7280]">
        Open or print from the local Syncthing mirror first. Browser preview stays available as a fallback.
      </p>

      {canPreview ? (
        <div className="mt-4">
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <iframe
              src={sourceUrl}
              title={title}
              className="h-[460px] w-full bg-white"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={printLocalUrl}
              className="rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
            >
              Print Local Copy
            </a>
            <a
              href={openLocalUrl}
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
            >
              Open Local File
            </a>
            <a
              href={kind === "image" || kind === "pdf" ? sourceUrl : printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
            >
              Browser Fallback
            </a>
            <a
              href={downloadUrl}
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F7F7F8]"
            >
              Download Copy
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#E53935]/30 bg-[#E53935]/10 p-4 text-sm text-[#111827]">
          <p className="font-medium text-[#111827]">Preview unavailable for this file type.</p>
          <p className="mt-1 text-[#6B7280]">
            Open the synced local file in the desktop app. Download is a fallback only.
          </p>
          <a
            href={printLocalUrl}
            className="mt-3 inline-block rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
          >
            Print Local Copy
          </a>
          <a
            href={downloadUrl}
            className="mt-3 inline-block rounded-xl bg-[#F4D400] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#e3c400]"
          >
            Download Copy
          </a>
        </div>
      )}
    </aside>
  );
}
