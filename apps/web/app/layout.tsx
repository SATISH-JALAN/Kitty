import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { FocusRing } from "@kitty/ui/components/FocusRing";
import { Toaster } from "@kitty/ui/components/Toast";
import { Grain } from "@kitty/ui/paper/Grain";
import { PaperFilters } from "@kitty/ui/paper/PaperFilters";
import { Providers } from "@/components/Providers";
import { copy } from "@/copy/en";
import { boska, fragment, switzer } from "./fonts";
import "./globals.css";
import "./stage.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: { default: "Kitty — savings parties", template: "%s · Kitty" },
  description: copy.brand.line,
  icons: {
    icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180" }],
  },
  openGraph: { title: "Kitty — savings parties", description: copy.brand.line, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#170E22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${boska.variable} ${switzer.variable} ${fragment.variable}`} suppressHydrationWarning>
      <body>
        {/* Marks JS and reduced motion before first paint so CSS can show end states otherwise. */}
        <Script id="kitty-boot" src="/boot.js" strategy="beforeInteractive" />
        <PaperFilters />
        <Providers>{children}</Providers>
        <Toaster />
        <Grain />
        <FocusRing />
      </body>
    </html>
  );
}
