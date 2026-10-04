import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "solid" | "outline" | "ghost";
type Size = "sm" | "md";

const base =
  "btn-fill inline-flex items-center justify-center gap-2 rounded-sm border font-medium whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,transform] duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  solid: "border-accent bg-accent text-bg [--fill:var(--grid-4)] motion-reduce:hover:brightness-110",
  outline:
    "btn-fill-flip border-accent text-accent [--fill:var(--accent)] motion-reduce:hover:bg-accent motion-reduce:hover:text-bg",
  ghost:
    "border-border text-text [--fill:var(--surface-2)] hover:border-border-2 motion-reduce:hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm pointer-coarse:h-11",
  md: "h-11 px-4 text-base sm:px-5",
};

export function buttonClass(variant: Variant = "ghost", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function Button({
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  href,
  external,
  ...rest
}: CommonProps & { href: string; external?: boolean } & Omit<
    ComponentProps<"a">,
    "className" | "children" | "href"
  >) {
  const cls = buttonClass(variant, size, className);
  if (external || /^(https?:|mailto:|tel:)/.test(href) || href.endsWith(".pdf")) {
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
