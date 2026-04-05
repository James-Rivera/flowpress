import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-ui-body",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-ui-display",
});

export const metadata: Metadata = {
  title: {
    default: "CJ NET Printing",
    template: "%s | CJ NET Printing",
  },
  description: "QR-based file submission and print workflow for CJ NET.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
