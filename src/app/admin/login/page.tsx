"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Invalid credentials");
      }

      router.push("/admin");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Invalid staff login. Check username and password, then try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-6 sm:py-8">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="h-1.5 w-full bg-[#F4D400]" />
        <div className="p-5 sm:p-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#F7F7F8] px-3 py-1 text-xs font-semibold text-[#111827]">
            <span className="h-2 w-2 rounded-full bg-[#E53935]" />
            Staff only
          </p>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            Staff Login
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Sign in to process queue jobs and confirm print status updates.
          </p>

          {errorMessage ? (
            <div
              className="mt-4 rounded-xl border border-[#E53935]/30 bg-[#E53935]/10 px-4 py-3 text-sm text-[#111827]"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-semibold text-[#111827]">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-base text-[#111827] placeholder:text-[#6B7280] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-[#111827]">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-base text-[#111827] placeholder:text-[#6B7280] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-1"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-xl bg-[#F4D400] px-4 py-3 text-base font-semibold text-[#111827] hover:bg-[#e3c400] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
