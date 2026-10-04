import type { CSSProperties } from "react";

const GOLD = "var(--id-golden-verdict)";
const mono = { fontFamily: "var(--font-mono)" } as CSSProperties;

/** The shared window: a sidebar for the customer role and a main panel. Flat, drawn on a 960 × 600 grid. */
function Window({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <rect width="960" height="600" fill="var(--bg)" />
      <rect width="220" height="600" fill="var(--surface)" />
      <line x1="220" y1="0" x2="220" y2="600" stroke="var(--border)" />
      <text x="28" y="48" fontSize="13" letterSpacing="1.6" fill="var(--muted)" style={mono}>
        CUSTOMER
      </text>
      {["Services", "Documents", "Requests"].map((item, i) => (
        <g key={item}>
          {item === title ? (
            <rect x="16" y={72 + i * 44} width="188" height="34" rx="6" fill="var(--surface-2)" />
          ) : null}
          <text
            x="30"
            y={94 + i * 44}
            fontSize="15"
            fill={item === title ? "var(--text)" : "var(--muted)"}
            style={mono}
          >
            {item}
          </text>
        </g>
      ))}
      {children}
    </>
  );
}

/** Beat 3 of Golden Verdict: documents uploaded against a purchase. An illustration: the real dashboard is private. */
function Upload() {
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of Golden Verdict's customer view: a drop area for documents and two uploads in progress"
      className="ill block size-full"
    >
      <Window title="Documents">
        <text x="270" y="70" fontSize="16" fill="var(--muted)" style={mono}>
          Upload documents
        </text>
        <rect
          x="270"
          y="96"
          width="640"
          height="150"
          rx="10"
          fill="none"
          stroke="var(--border-2)"
          strokeWidth="2"
          strokeDasharray="8 8"
        />
        <text x="590" y="178" fontSize="17" fill="var(--muted)" textAnchor="middle" style={mono}>
          Drop documents here
        </text>
        {[
          { y: 300, w: 1, label: "document-1", pct: "100%" },
          { y: 360, w: 0.62, label: "document-2", pct: "62%" },
        ].map((f, i) => (
          <g key={f.label}>
            <text x="270" y={f.y + 6} fontSize="16" fill="var(--text)" style={mono}>
              {f.label}
            </text>
            <rect x="430" y={f.y - 6} width="400" height="12" rx="6" fill="var(--surface-2)" />
            <rect
              className={i === 1 ? "ill-grow" : undefined}
              x="430"
              y={f.y - 6}
              width={400 * f.w}
              height="12"
              rx="6"
              fill={GOLD}
              style={{ transformOrigin: "430px 0" }}
            />
            <text x="850" y={f.y + 6} fontSize="15" fill="var(--muted)" style={mono}>
              {f.pct}
            </text>
          </g>
        ))}
        <rect x="270" y="430" width="130" height="44" rx="8" fill="none" stroke={GOLD} strokeWidth="2" />
        <text x="335" y="458" fontSize="16" fill="var(--text)" textAnchor="middle" style={mono}>
          Submit
        </text>
      </Window>
    </svg>
  );
}

/** Beat 4: the request ID and its automated status updates. */
function Track() {
  const phases = ["Purchased", "Documents", "In progress", "Done"];
  const at = 2;
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of a Golden Verdict request: its request ID, a four-step timeline at In progress, and a status updated notice"
      className="ill block size-full"
    >
      <Window title="Requests">
        <text x="270" y="70" fontSize="16" fill="var(--muted)" style={mono}>
          Your request
        </text>
        <rect
          x="270"
          y="96"
          width="170"
          height="44"
          rx="8"
          fill="none"
          stroke="var(--border-2)"
          strokeWidth="2"
        />
        <text x="355" y="125" fontSize="20" fill="var(--text)" textAnchor="middle" style={mono}>
          REQ-····
        </text>
        {phases.map((p, i) => {
          const x = 320 + i * 190;
          return (
            <g key={p}>
              {i < phases.length - 1 ? (
                <line
                  x1={x + 14}
                  y1="262"
                  x2={x + 176}
                  y2="262"
                  stroke={i < at ? GOLD : "var(--border-2)"}
                  strokeWidth="3"
                />
              ) : null}
              <circle
                className={i <= at ? "ill-node" : undefined}
                style={{ ["--i" as string]: i } as CSSProperties}
                cx={x}
                cy="262"
                r="12"
                fill={i <= at ? GOLD : "var(--bg)"}
                stroke={i <= at ? GOLD : "var(--border-2)"}
                strokeWidth="3"
              />
              <text
                x={x}
                y="306"
                fontSize="15"
                fill={i <= at ? "var(--text)" : "var(--muted)"}
                textAnchor="middle"
                style={mono}
              >
                {p}
              </text>
            </g>
          );
        })}
        <rect x="270" y="372" width="360" height="46" rx="8" fill="none" stroke={GOLD} strokeWidth="2" />
        <circle cx="296" cy="395" r="6" fill={GOLD} />
        <text x="314" y="401" fontSize="16" fill="var(--text)" style={mono}>
          Status updated · email sent
        </text>
      </Window>
    </svg>
  );
}

export function GoldenVerdictBeat({ id }: { id: "gv-upload" | "gv-track" }) {
  return id === "gv-upload" ? <Upload /> : <Track />;
}
