import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import { ShortcutsHost } from "@/components/palette/ShortcutsHost";
import { ToastHost } from "@/components/ui/ToastHost";
import { baseMetadata } from "@/lib/seo/metadata";
import "./globals.css";

// Self-hosted at build time by next/font (no runtime request to Google), Latin subset only.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
// Mono is used for small labels, never the LCP element — don't let it compete with the preload.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = baseMetadata;

export const viewport: Viewport = {
  themeColor: "#0d1117",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        <Nav />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
        <ShortcutsHost />
        <ToastHost />
      </body>
    </html>
  );
}
