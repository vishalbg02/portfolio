"use client";

import "./globals.css";

/** Last-resort boundary: replaces the root layout, so it renders its own <html>/<body>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body className="flex min-h-dvh items-center">
        <main className="container-page py-24">
          <p className="font-mono text-sm text-danger">✕ fatal error</p>
          <h1 className="mt-3 text-3xl font-semibold">This page didn&apos;t ship.</h1>
          <p className="mt-3 text-muted">An unexpected error occurred.</p>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-sm border border-accent bg-accent px-5 font-medium text-bg"
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- router may be unavailable here */}
            <a href="/" className="inline-flex h-11 items-center rounded-sm border border-border px-5">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
