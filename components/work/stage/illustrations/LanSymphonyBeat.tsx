import type { CSSProperties } from "react";

const C = "var(--id-lansymphony)";
const mono = { fontFamily: "var(--font-mono)" } as CSSProperties;
const L = ["var(--grid-1)", "var(--grid-2)", "var(--grid-3)", "var(--grid-4)"];

/** A laptop-in-a-circle peer, drawn at (x, y) and scaled for the 960 × 600 canvas. */
function Peer({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <g transform={`translate(${x} ${y}) scale(1.5)`}>
        <circle r="38" fill="var(--surface)" stroke={C} strokeWidth="2.5" />
        <rect
          x="-17"
          y="-14"
          width="34"
          height="22"
          rx="3"
          fill="none"
          stroke="var(--text)"
          strokeWidth="2.5"
        />
        <line x1="-10" y1="17" x2="10" y2="17" stroke="var(--text)" strokeWidth="2.5" />
      </g>
      {label ? (
        <text x={x} y={y + 92} fontSize="22" fill="var(--muted)" textAnchor="middle" style={mono}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Discover() {
  const peers = [
    { x: 480, y: 120, label: "peer" },
    { x: 150, y: 330, label: "peer" },
    { x: 810, y: 330, label: "peer" },
    { x: 480, y: 470, label: "peer" },
  ];
  const links: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [0, 3],
    [1, 2],
  ];
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of four peers on a local network finding each other, with no server in the middle"
      className="ill block size-full"
    >
      <rect width="960" height="600" fill="var(--bg)" />
      <g stroke={C} strokeOpacity="0.6" strokeWidth="3.5" fill="none">
        {links.map(([a, b], i) => (
          <line
            key={i}
            className="ill-link"
            style={{ ["--i" as string]: i } as CSSProperties}
            x1={peers[a]!.x}
            y1={peers[a]!.y}
            x2={peers[b]!.x}
            y2={peers[b]!.y}
          />
        ))}
      </g>
      {peers.map((p, i) => (
        <g key={i}>
          <circle
            className="ill-ring"
            style={{ ["--i" as string]: i } as CSSProperties}
            cx={p.x}
            cy={p.y}
            r="57"
            fill="none"
            stroke={C}
            strokeWidth="3"
            strokeDasharray="8 9"
          />
          <Peer x={p.x} y={p.y} label={p.label} />
        </g>
      ))}
    </svg>
  );
}

function Encrypt() {
  // ciphertext: a block of contribution squares
  const cipher = Array.from({ length: 32 }, (_, i) => ({
    x: 352 + (i % 8) * 32,
    y: 262 + Math.floor(i / 8) * 32,
    l: (i * 7 + (i % 5)) % 4,
  }));
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of plain text leaving one peer, crossing the network as scrambled squares under an AES-256 lock, and arriving at the other peer"
      className="ill block size-full"
    >
      <rect width="960" height="600" fill="var(--bg)" />
      <Peer x={110} y={330} label="sender" />
      <Peer x={850} y={330} label="receiver" />
      <line x1="168" y1="330" x2="792" y2="330" stroke={C} strokeOpacity="0.6" strokeWidth="3.5" />
      <rect
        x="196"
        y="298"
        width="132"
        height="64"
        rx="10"
        fill="var(--surface)"
        stroke="var(--border-2)"
        strokeWidth="2.5"
      />
      <text x="262" y="338" fontSize="21" fill="var(--text)" textAnchor="middle" style={mono}>
        text
      </text>
      <g className="ill-cipher">
        {cipher.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="26" height="26" rx="4" fill={L[c.l]} />
        ))}
      </g>
      <g transform="translate(480 150) scale(1.7)">
        <rect x="-22" y="-4" width="44" height="34" rx="6" fill={C} />
        <path d="M-12 -4 v-12 a12 12 0 0 1 24 0 v12" fill="none" stroke={C} strokeWidth="5" />
        <circle cx="0" cy="12" r="4" fill="var(--bg)" />
      </g>
      <text x="480" y="82" fontSize="36" fill="var(--text)" textAnchor="middle" style={mono}>
        AES-256
      </text>
      <rect
        x="632"
        y="298"
        width="132"
        height="64"
        rx="10"
        fill="var(--surface)"
        stroke="var(--border-2)"
        strokeWidth="2.5"
      />
      <text x="698" y="338" fontSize="21" fill="var(--text)" textAnchor="middle" style={mono}>
        text
      </text>
    </svg>
  );
}

function Calls() {
  const bars = [30, 62, 44, 88, 52, 100, 38, 70, 48, 82, 36, 58];
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of three kinds of traffic between peers: a video call grid, an audio waveform and a shared screen with a small picture-in-picture window"
      className="ill block size-full"
    >
      <rect width="960" height="600" fill="var(--bg)" />
      {/* video */}
      <g>
        <rect
          x="40"
          y="90"
          width="280"
          height="330"
          rx="14"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2.5"
        />
        {[0, 1, 2, 3].map((i) => {
          const x = 58 + (i % 2) * 130;
          const y = 108 + Math.floor(i / 2) * 150;
          return (
            <g key={i}>
              <rect x={x} y={y} width="116" height="136" rx="10" fill="var(--surface-2)" />
              <circle cx={x + 58} cy={y + 52} r="20" fill="none" stroke={C} strokeWidth="3.5" />
              <path d={`M${x + 22} ${y + 118} a36 32 0 0 1 72 0`} fill="none" stroke={C} strokeWidth="3.5" />
            </g>
          );
        })}
        <text x="180" y="494" fontSize="28" fill="var(--text)" textAnchor="middle" style={mono}>
          HD video
        </text>
      </g>
      {/* audio */}
      <g>
        <rect
          x="340"
          y="90"
          width="280"
          height="330"
          rx="14"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2.5"
        />
        {bars.map((h, i) => (
          <rect
            key={i}
            className="ill-bar"
            style={{ ["--i" as string]: i, transformOrigin: `${368 + i * 19}px 255px` } as CSSProperties}
            x={362 + i * 19}
            y={255 - h * 1.1}
            width="12"
            height={h * 2.2}
            rx="6"
            fill={C}
          />
        ))}
        <text x="480" y="494" fontSize="28" fill="var(--text)" textAnchor="middle" style={mono}>
          VoIP audio
        </text>
      </g>
      {/* screen */}
      <g>
        <rect
          x="640"
          y="90"
          width="280"
          height="330"
          rx="14"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2.5"
        />
        <rect x="662" y="130" width="236" height="190" rx="10" fill="var(--surface-2)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x="680"
            y={152 + i * 30}
            width={170 - (i % 2) * 50}
            height="12"
            rx="6"
            fill="var(--border-2)"
          />
        ))}
        <rect x="790" y="262" width="94" height="52" rx="8" fill="var(--bg)" stroke={C} strokeWidth="3" />
        <circle cx="837" cy="280" r="9" fill="none" stroke={C} strokeWidth="2.5" />
        <text x="780" y="494" fontSize="28" fill="var(--text)" textAnchor="middle" style={mono}>
          Screen + PiP
        </text>
      </g>
    </svg>
  );
}

export function LanSymphonyBeat({ id }: { id: "ls-discover" | "ls-encrypt" | "ls-calls" }) {
  if (id === "ls-discover") return <Discover />;
  if (id === "ls-encrypt") return <Encrypt />;
  return <Calls />;
}
