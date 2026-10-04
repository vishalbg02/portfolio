import { ImageResponse } from "next/og";
import { profile } from "@/content/profile";

/**
 * Open Graph / Twitter card renderer: flat dark card, name, page title, mono path, and a small
 * contribution-grid motif. No gradients — flat colors only (matches the site).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const BG = "#0d1117";
const SURFACE = "#161b22";
const BORDER = "#30363d";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";
const GREEN = "#3fb950";
const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

/** Deterministic pseudo-random levels so the motif is stable between builds. */
function level(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const r = n - Math.floor(n);
  return r > 0.9 ? 4 : r > 0.78 ? 3 : r > 0.62 ? 2 : r > 0.4 ? 1 : 0;
}

export function renderOg({
  title,
  kicker,
  path,
  accent = GREEN,
  image,
}: {
  title: string;
  kicker?: string;
  path: string;
  accent?: string;
  /** A real capture (a data URL) shown in a flat frame beside the title. */
  image?: string | null;
}) {
  const cols = 16;
  const rows = 6;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        color: TEXT,
        padding: "64px 72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: MUTED }}>
        <div style={{ display: "flex", color: MUTED }}>~/vishalbg</div>
        <div style={{ display: "flex", width: 14, height: 30, background: GREEN }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: image ? 560 : 1000 }}>
          {kicker ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: MUTED }}>
              <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: accent }} />
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: image ? (title.length > 18 ? 56 : 68) : title.length > 28 ? 68 : 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: image ? 560 : 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{ display: "flex", fontSize: image ? 26 : 32, color: MUTED, maxWidth: image ? 560 : 900 }}
          >
            {profile.headline}
          </div>
        </div>
        {image ? (
          <div
            style={{
              display: "flex",
              border: `2px solid ${BORDER}`,
              background: SURFACE,
              borderRadius: 16,
              padding: 12,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              width={440}
              height={275}
              style={{ borderRadius: 8, objectFit: "cover", objectPosition: "top" }}
              alt=""
            />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            color: MUTED,
            border: `2px solid ${BORDER}`,
            background: SURFACE,
            borderRadius: 999,
            padding: "10px 22px",
          }}
        >
          <div style={{ display: "flex", color: GREEN }}>$</div>
          <div style={{ display: "flex" }}>{path}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: rows }, (_, y) => (
            <div key={y} style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: cols }, (_, x) => (
                <div
                  key={x}
                  style={{
                    display: "flex",
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: LEVELS[level(x, y)],
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
