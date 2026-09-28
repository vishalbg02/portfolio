"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="container-page py-24">
      <p className="font-mono text-sm text-danger">✕ runtime error</p>
      <h1 className="mt-3 text-3xl font-semibold">Something broke while rendering this page.</h1>
      <p className="mt-3 max-w-xl text-muted">
        It&apos;s been logged. You can retry, or head back home.
        {error.digest ? <span className="mt-2 block font-mono text-xs">ref: {error.digest}</span> : null}
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="solid" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
