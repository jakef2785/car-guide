import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "CarGuide — car research backed by real data", template: "%s | CarGuide" },
  description:
    "Browse and search cars with specs, fuel economy, recalls and MOT reliability — every figure traced to a named source.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} flex min-h-screen flex-col antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-700 focus:shadow"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main" tabIndex={-1} className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
