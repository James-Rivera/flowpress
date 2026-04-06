"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getPublicApiUrl } from "@/lib/public-api";
import { getClientUploadLimits, validateUploadFiles } from "@/lib/upload-rules";

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
const UPLOAD_LIMITS = getClientUploadLimits();

const MOBILE_SOFT_WARNING_MB = 20;
const LOW_MEMORY_HARD_LIMIT_MB = 25;

function detectMobileUserAgent(userAgent: string, maxTouchPoints: number) {
  if (/Android/i.test(userAgent)) {
    return true;
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return true;
  }

  // iPadOS 13+ reports as Macintosh but has touch.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) {
    return true;
  }

  return false;
}

function mergeFiles(existing: File[], incoming: File[]) {
  const map = new Map<string, File>();

  for (const file of [...existing, ...incoming]) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    map.set(key, file);
  }

  return Array.from(map.values());
}

function validateFiles(files: File[]) {
  return validateUploadFiles(files, UPLOAD_LIMITS);
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
  const [clientHints, setClientHints] = useState<{
    isMobile: boolean;
    deviceMemoryGb: number | null;
    isLowMemoryDevice: boolean;
  } | null>(null);
  const [name, setName] = useState("");
  const [size, setSize] = useState<(typeof SIZE_OPTIONS)[number]>("A4");
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<(typeof COLOR_OPTIONS)[number]>("B&W");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const userAgent = navigator.userAgent || "";
      const maxTouchPoints = navigator.maxTouchPoints ?? 0;
      const isMobile = detectMobileUserAgent(userAgent, maxTouchPoints);
      const deviceMemoryGbRaw = (navigator as unknown as { deviceMemory?: unknown }).deviceMemory;
      const deviceMemoryGb = typeof deviceMemoryGbRaw === "number" && Number.isFinite(deviceMemoryGbRaw)
        ? deviceMemoryGbRaw
        : null;

      setClientHints({
        isMobile,
        deviceMemoryGb,
        isLowMemoryDevice: deviceMemoryGb !== null && deviceMemoryGb <= 2,
      });
    } catch {
      setClientHints({ isMobile: false, deviceMemoryGb: null, isLowMemoryDevice: false });
    }
  }, []);

  const colorHint =
    color === "Color"
      ? "Color jobs can take a little longer depending on the live queue."
      : "B&W is usually the quickest option for most print requests.";

  const addFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setSelectedFiles((current) => {
      const merged = mergeFiles(current, files);
      const validationError = (() => {
        const baseError = validateFiles(merged);

        if (baseError) {
          return baseError;
        }

        if (clientHints?.isLowMemoryDevice) {
          const hardLimitBytes = LOW_MEMORY_HARD_LIMIT_MB * 1024 * 1024;
          const tooLarge = merged.find((file) => file.size > hardLimitBytes);

          if (tooLarge) {
            return `This phone may run out of memory on very large files. Please keep each file under ${LOW_MEMORY_HARD_LIMIT_MB}MB, or send it using Gmail/Messenger instead.`;
          }
        }

        return null;
      })();

      if (validationError) {
        setSubmitState({ tone: "error", message: validationError });
        return current;
      }

      setSubmitState(null);
      return merged;
    });
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

    const filesError = (() => {
      const baseError = validateFiles(selectedFiles);

      if (baseError) {
        return baseError;
      }

      if (clientHints?.isLowMemoryDevice) {
        const hardLimitBytes = LOW_MEMORY_HARD_LIMIT_MB * 1024 * 1024;
        const tooLarge = selectedFiles.find((file) => file.size > hardLimitBytes);

        if (tooLarge) {
          return `This phone may run out of memory on very large files. Please keep each file under ${LOW_MEMORY_HARD_LIMIT_MB}MB, or send it using Gmail/Messenger instead.`;
        }
      }

      return null;
    })();

    if (filesError) {
      setSubmitState({
        tone: "error",
        message: filesError,
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
      const response = await fetch(getPublicApiUrl("/api/upload"), {
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
      ? "border-[#E53935]/20 bg-[#fff0ef] text-foreground"
      : "border-[#F4D400]/30 bg-[#fff7d0] text-foreground";

  const largestSelectedFileBytes = selectedFiles.reduce((largest, file) => Math.max(largest, file.size), 0);
  const shouldShowMobileLargeFileWarning =
    Boolean(clientHints?.isMobile) &&
    largestSelectedFileBytes >= MOBILE_SOFT_WARNING_MB * 1024 * 1024;

  return (
    <main className="app-shell">
      {isRedirecting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4 backdrop-blur-sm">
          <section className="glass-card w-full max-w-md rounded-[1.5rem] p-7 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#e5e7eb] border-t-[#F4D400]" />
            <h2 className="display-title mt-5 text-3xl font-semibold text-foreground">Upload received</h2>
            <p className="mt-2 text-sm text-[#5F5B52]">Opening your batch tracker now...</p>
          </section>
        </div>
      ) : null}

      <section className="page-wrap customer-wrap space-y-4">
        <header className="mx-auto w-full max-w-3xl rounded-[1.5rem] border border-[rgba(20,23,31,0.08)] bg-white p-5 shadow-[0_6px_18px_rgba(20,23,31,0.05)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Upload file</h1>
            <Link href="/" className="secondary-btn !px-4 !py-2 !text-sm">
              Back
            </Link>
          </div>
          <p className="mt-2 text-sm text-text-secondary">Add your file, enter the details, then send it to the queue.</p>
          <p className="mt-3 text-xs text-text-secondary">
            Up to {UPLOAD_LIMITS.maxFileCount} files, {UPLOAD_LIMITS.maxFileSizeMb}MB each, {UPLOAD_LIMITS.maxBatchSizeMb}MB total.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl space-y-4">
          {submitState ? (
            <div
              className={`rounded-[1rem] border px-4 py-3 text-sm ${submitStateClassName}`}
              role="status"
              aria-live="polite"
            >
              {submitState.message}
            </div>
          ) : null}

          <section className="section-card rounded-[1.5rem] p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#111827]">Files</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Tap to choose files, or drag them here.</p>

            {shouldShowMobileLargeFileWarning ? (
              <div
                className="mt-4 rounded-[1rem] border border-[rgba(23,23,23,0.1)] bg-[rgba(255,248,230,0.72)] px-4 py-3 text-sm text-foreground"
                role="status"
                aria-live="polite"
              >
                Large PDFs can fail to upload on some phones due to low memory. If it won&apos;t send, close other apps, try fewer files, or use Gmail/Messenger to send it instead.
              </div>
            ) : null}

            <label
              htmlFor="file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-4 block cursor-pointer rounded-[1rem] border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? "border-[#F4D400] bg-[#fff9d6]"
                  : "border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#F4D400]/70 hover:bg-white"
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
              <p className="mt-1 text-xs text-[#6B7280]">PDF, DOCX, JPG, JPEG, PNG</p>
            </label>

            {selectedFiles.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between rounded-[1rem] border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-3 text-[#111827]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="secondary-btn !rounded-[0.7rem] !px-2.5 !py-1.5 !text-xs !font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  className="secondary-btn w-full !text-sm !font-medium"
                >
                  Clear all files
                </button>
              </div>
            ) : null}
          </section>

          <section className="section-card rounded-[1.5rem] p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#111827]">Print details</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                  className="input-field"
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
                  className="input-field"
                >
                  {SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="color" className="text-sm font-semibold text-[#111827]">
                  Print mode
                </label>
                <select
                  id="color"
                  name="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value as (typeof COLOR_OPTIONS)[number])}
                  className="input-field"
                >
                  {COLOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#6B7280]">{colorHint}</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="copies" className="text-sm font-semibold text-[#111827]">
                  Copies
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="secondary-btn !rounded-[0.9rem] !px-4 !py-3 !text-lg"
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
                    className="input-field w-24 text-center font-semibold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(Math.min(50, copies + 1))}
                    className="secondary-btn !rounded-[0.9rem] !px-4 !py-3 !text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting || isRedirecting}
              className="primary-btn flex-1 text-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : "Send to Print Queue"}
            </button>
            <button
              type="button"
              onClick={clearSelectedFiles}
              className="secondary-btn flex-1"
            >
              Clear files
            </button>
          </div>

          <p className="text-center text-xs text-text-secondary">
            Staff reviews each request before printing starts.
          </p>
        </form>
      </section>
    </main>
  );
}
