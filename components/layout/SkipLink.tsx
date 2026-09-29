export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-sm bg-accent px-4 py-2 font-mono text-sm text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
    >
      Skip to content
    </a>
  );
}
