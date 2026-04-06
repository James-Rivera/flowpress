import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import { pickEmailComposeHref } from "@/lib/email-links";
import { MessengerActionLink } from "@/app/_components/messenger-action-link";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 16V5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M7 18.5c-1.7 0-3-1.3-3-3V7.8c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v7.7c0 1.7-1.3 3-3 3H11l-4 2.7V18.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 7.5 12 13l8-5.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="7" y="3.5" width="10" height="17" rx="2.2" />
      <path d="M11 17.5h2" strokeLinecap="round" />
    </svg>
  );
}

export default async function Home() {
  const userAgent = (await headers()).get("user-agent") ?? "";

  const messengerWebHref = "https://m.me/cjnetvalley";
  const messengerAppHref = "fb-messenger://user-thread/cjnetvalley";

  const to = "cjnetvalley@gmail.com";
  const subject = "CJ NET Print Request";
  const body = [
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

  const emailHref = pickEmailComposeHref({
    to,
    subject,
    body,
    userAgent,
  });

  const quickActions = [
    {
      href: "/upload",
      label: "Upload File",
      icon: <UploadIcon />,
      external: false,
    },
    {
      href: messengerWebHref,
      label: "Send via Messenger",
      icon: <MessageIcon />,
      external: true,
    },
    {
      href: emailHref,
      label: "Send via Email",
      icon: <MailIcon />,
      external: true,
    },
    {
      href: "/send/bluetooth",
      label: "In-shop transfer",
      icon: <PhoneIcon />,
      external: false,
    },
  ] as const;

  return (
    <main className="app-shell">
      <section className="page-wrap customer-wrap">
        <section className="mx-auto max-w-md rounded-[1.5rem] border border-[rgba(20,23,31,0.08)] bg-white p-5 shadow-[0_6px_18px_rgba(20,23,31,0.05)] sm:p-6">
          <div className="flex justify-center">
            <Link href="/" className="utility-logo-link w-full max-w-[160px]">
              <Image
                src="/logo.svg"
                alt="CJ NET shop logo"
                width={360}
                height={120}
                className="h-auto w-full"
                priority
              />
            </Link>
          </div>

          <p className="mt-5 text-center text-sm font-medium text-[#5F6778]">Choose how to send your file.</p>

          <div className="mt-4 space-y-3">
            {quickActions.map((action) => {
              const content = (
                <>
                  <span className="utility-action-icon" aria-hidden="true">
                    {action.icon}
                  </span>
                  <span>{action.label}</span>
                </>
              );

              if (action.external) {
                if (action.href === messengerWebHref) {
                  return (
                    <MessengerActionLink
                      key={action.label}
                      hrefWeb={messengerWebHref}
                      hrefApp={messengerAppHref}
                      className="utility-action-btn"
                    >
                      {content}
                    </MessengerActionLink>
                  );
                }

                const openInNewTab = action.href.startsWith("http://") || action.href.startsWith("https://");

                return (
                  <a
                    key={action.label}
                    href={action.href}
                    target={openInNewTab ? "_blank" : undefined}
                    rel={openInNewTab ? "noopener noreferrer" : undefined}
                    className="utility-action-btn"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <Link key={action.label} href={action.href} className="utility-action-btn">
                  {content}
                </Link>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-[#5F6778]">
            If you need help, show this page to staff.
          </p>
        </section>
      </section>
    </main>
  );
}
