"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SubmitState = {
  tone: "success" | "error";
  message: string;
} | null;

type UploadedJob = {
  filename: string;
  relativePath: string;
  status: "pending";
};

const SIZE_OPTIONS = ["A4", "Short", "Long"] as const;
const COLOR_OPTIONS = ["B&W", "Color"] as const;

function mergeFiles(existing: File[], incoming: File[]) {
  const map = new Map<string, File>();

  for (const file of [...existing, ...incoming]) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    map.set(key, file);
  }

  return Array.from(map.values());
}

function rememberRecentBatch(batchId: string) {
  try {
    const key = "cjnet_recent_batches";
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    const next = [batchId, ...parsed.filter((value) => value !== batchId)].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore local storage failures.
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [size, setSize] = useState<(typeof SIZE_OPTIONS)[number]>("A4");
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<(typeof COLOR_OPTIONS)[number]>("B&W");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colorHint =
    color === "Color"
      ? "Color prints may take slightly longer based on queue volume."
      : "B&W is typically the fastest option for queue processing.";

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setSelectedFiles((current) => mergeFiles(current, files));
    setSubmitState(null);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setSubmitState(null);
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setSubmitState(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files || []);
    addFiles(files);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setSubmitState({
        tone: "error",
        message: "Please choose at least one file before submitting.",
      });
      return;
    }

    if (!name.trim()) {
      setSubmitState({
        tone: "error",
        message: "Please enter your name.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitState(null);

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("file", file);
    }

    formData.set("name", name.trim());
    formData.set("size", size);
    formData.set("copies", String(copies));
    formData.set("color", color);
    formData.set("folder", "General");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        batchId?: string;
        uploadedCount?: number;
        jobs?: UploadedJob[];
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Upload failed");
      }

      clearSelectedFiles();

      if (!payload.batchId) {
        throw new Error("Upload completed but tracking batch is missing");
      }

      rememberRecentBatch(payload.batchId);

      setIsRedirecting(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      router.push(`/upload/track?batch=${encodeURIComponent(payload.batchId)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed. Check your files and try again.";
      setSubmitState({
        tone: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitStateClassName =
    submitState?.tone === "error"
      ? "border-[#E53935]/30 bg-[#E53935]/10 text-[#111827]"
      : "border-[#F4D400]/40 bg-[#fff9d6] text-[#111827]";

  return (
    <main className="relative min-h-screen bg-[#F7F7F8] px-4 py-6 sm:px-6 sm:py-8">
      {isRedirecting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F7F7F8]/95 px-4">
          <section className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#E5E7EB] border-t-[#F4D400]" />
            <h2 className="mt-4 text-xl font-semibold text-[#111827]">Upload successful</h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Opening your queue status page...
            </p>
          </section>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-xl space-y-4">
        <header className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="h-1.5 w-full bg-[#F4D400]" />
          <div className="p-5 sm:p-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#F7F7F8] px-3 py-1 text-xs font-semibold text-[#111827]">
              <span className="h-2 w-2 rounded-full bg-[#E53935]" />
              Staff will confirm before printing
            </p>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Send Files for Printing
            </h1>
            <p className="mt-2 text-sm text-[#6B7280] sm:text-base">
              Fill in your details then tap the yellow button to submit.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitState ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${submitStateClassName}`}
              role="status"
              aria-live="polite"
            >
              {submitState.message}
            </div>
          ) : null}

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#111827]">Choose your files</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Tap to choose files, or drag them here.</p>

            <label
              htmlFor="file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-4 block cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? "border-[#F4D400] bg-[#fff9d6]"
                  : "border-[#E5E7EB] bg-[#F7F7F8] hover:border-[#F4D400]/70"
              }`}
            >
              <input
                ref={fileInputRef}
                id="file"
                name="file"
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  addFiles(files);
                }}
                className="sr-only"
                required
              />
              <p className="text-base font-semibold text-[#111827]">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) selected`
                  : "Tap to choose files"}
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">PDF, JPG, PNG, DOCX, XLSX</p>
            </label>

            {selectedFiles.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-3 text-[#111827]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#111827] hover:bg-[#F7F7F8]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F7F7F8]"
                >
                  Clear all files
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[#111827]">Print details</h2>

            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-sm font-semibold text-[#111827]">
                  Your name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white p-4 text-base text-[#111827] placeholder:text-[#6B7280] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="size" className="text-sm font-semibold text-[#111827]">
                  Paper size
                </label>
                <select
                  id="size"
                  name="size"
                  value={size}
                  onChange={(event) => setSize(event.target.value as (typeof SIZE_OPTIONS)[number])}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white p-4 text-base text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
                >
                  {SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="copies" className="text-sm font-semibold text-[#111827]">
                  How many copies?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-lg font-semibold text-[#111827] hover:bg-[#F7F7F8]"
                  >
                    -
                  </button>
                  <input
                    id="copies"
                    name="copies"
                    type="number"
                    min={1}
                    max={50}
                    value={copies}
                    onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
                    className="w-24 rounded-xl border border-[#E5E7EB] bg-white p-3 text-center text-base font-semibold text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(Math.min(50, copies + 1))}
                    className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-lg font-semibold text-[#111827] hover:bg-[#F7F7F8]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="color" className="text-sm font-semibold text-[#111827]">
                  Color or black and white?
                </label>
                <select
                  id="color"
                  name="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value as (typeof COLOR_OPTIONS)[number])}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white p-4 text-base text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
                >
                  {COLOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#6B7280]">{colorHint}</p>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={isSubmitting || isRedirecting}
            className="w-full rounded-2xl bg-[#F4D400] px-5 py-4 text-lg font-bold text-[#111827] hover:bg-[#e3c400] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Submitting..." : "Send to Print Queue"}
          </button>
        </form>
      </section>
    </main>
  );
}
