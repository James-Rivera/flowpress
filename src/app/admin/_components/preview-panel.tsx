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
    <aside className="rounded-[1.5rem] border border-[#E5E7EB] bg-white p-4 shadow-[0_6px_18px_rgba(20,23,31,0.05)]">
      <h2 className="text-lg font-semibold text-[#111827]">Preview</h2>
      <p className="mt-1 text-xs text-[#6B7280]">{title}</p>
      <p className="mt-2 rounded-[1rem] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs text-[#6B7280]">
        Open or print from the local Syncthing mirror first. Browser preview stays available as a fallback.
      </p>

      {canPreview ? (
        <div className="mt-4">
          <div className="overflow-hidden rounded-[1rem] border border-[#E5E7EB]">
            <iframe
              src={sourceUrl}
              title={title}
              className="h-[460px] w-full bg-white"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={printLocalUrl}
              className="primary-btn !px-4 !py-2 !text-sm"
            >
              Print Local Copy
            </a>
            <a
              href={openLocalUrl}
              className="secondary-btn !px-4 !py-2 !text-sm"
            >
              Open Local File
            </a>
            <a
              href={kind === "image" || kind === "pdf" ? sourceUrl : printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-btn !px-4 !py-2 !text-sm"
            >
              Browser Fallback
            </a>
            <a
              href={downloadUrl}
              className="secondary-btn !px-4 !py-2 !text-sm"
            >
              Download Copy
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[1rem] border border-[#E53935]/30 bg-[#E53935]/10 p-4 text-sm text-[#111827]">
          <p className="font-medium text-[#111827]">Preview unavailable for this file type.</p>
          <p className="mt-1 text-[#6B7280]">
            Open the synced local file in the desktop app. Download is a fallback only.
          </p>
          <a
            href={printLocalUrl}
            className="primary-btn mt-3 inline-flex !px-4 !py-2 !text-sm"
          >
            Print Local Copy
          </a>
          <a
            href={downloadUrl}
            className="secondary-btn mt-3 inline-flex !px-4 !py-2 !text-sm"
          >
            Download Copy
          </a>
        </div>
      )}
    </aside>
  );
}
