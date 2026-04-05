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
    <main className="app-shell">
      <section className="page-wrap customer-wrap">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="glass-card rounded-[1.5rem] px-6 py-7 sm:px-8 sm:py-8">
            <div className="brand-badge">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E53935]" />
              Staff workspace
            </div>
            <h1 className="display-title mt-4 text-[2.2rem] leading-tight font-semibold text-[#171717] sm:text-[2.9rem]">
              Staff access for queue management.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#5F5B52]">
              Use the admin view to start jobs, confirm completed prints, and keep the queue moving without losing
              the current task.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="stat-card">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F5B52]">Focused</p>
                <p className="mt-2 text-lg font-semibold text-[#171717]">One live print state</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F5B52]">Manual</p>
                <p className="mt-2 text-lg font-semibold text-[#171717]">Staff confirms transitions</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F5B52]">Practical</p>
                <p className="mt-2 text-lg font-semibold text-[#171717]">Built for queue speed</p>
              </div>
            </div>
          </section>

          <section className="section-card rounded-[1.5rem] p-6 sm:p-7">
            <div className="status-pill status-pill-danger">
              <span className="h-2 w-2 rounded-full bg-[#E53935]" />
              Staff only
            </div>
            <h2 className="display-title mt-4 text-2xl font-semibold text-[#171717]">Sign in</h2>
            <p className="mt-2 text-sm leading-7 text-[#5F5B52]">
              Enter your staff account to manage queue actions and print confirmations.
            </p>

            {errorMessage ? (
              <div className="mt-4 rounded-[1rem] border border-[#E53935]/20 bg-[#fff0ef] px-4 py-3 text-sm text-[#171717]" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="username" className="text-sm font-semibold text-[#171717]">
                  Username
                </label>
                <input id="username" name="username" type="text" required autoComplete="username" className="input-field" />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-semibold text-[#171717]">
                  Password
                </label>
                <input id="password" name="password" type="password" required autoComplete="current-password" className="input-field" />
              </div>

              <button type="submit" disabled={isSubmitting} className="primary-btn mt-2 w-full disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? "Signing in..." : "Login"}
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
