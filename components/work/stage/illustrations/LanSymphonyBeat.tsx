import type { CSSProperties } from "react";

const C = "var(--id-lansymphony)";
const mono = { fontFamily: "var(--font-mono)" } as CSSProperties;
const L = ["var(--grid-1)", "var(--grid-2)", "var(--grid-3)", "var(--grid-4)"];

/** A laptop-in-a-circle peer. */
function Peer({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="38" fill="var(--surface)" stroke={C} strokeWidth="2.5" />
      <rect
        x={x - 17}
        y={y - 14}
        width="34"
        height="22"
        rx="3"
        fill="none"
        stroke="var(--text)"
        strokeWidth="2.5"
      />
      <line x1={x - 10} y1={y + 17} x2={x + 10} y2={y + 17} stroke="var(--text)" strokeWidth="2.5" />
      {label ? (
        <text x={x} y={y + 66} fontSize="14" fill="var(--muted)" textAnchor="middle" style={mono}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Discover() {
  const peers = [
    { x: 480, y: 150, label: "peer" },
    { x: 200, y: 340, label: "peer" },
    { x: 760, y: 340, label: "peer" },
    { x: 480, y: 450, label: "peer" },
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
      <g stroke={C} strokeOpacity="0.6" strokeWidth="2.5" fill="none">
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
            r="38"
            fill="none"
            stroke={C}
            strokeWidth="2"
            strokeDasharray="6 7"
          />
          <Peer x={p.x} y={p.y} label={p.label} />
        </g>
      ))}
    </svg>
  );
}

function Encrypt() {
  // ciphertext: a block of contribution squares
  const cipher = Array.from({ length: 24 }, (_, i) => ({
    x: 420 + (i % 6) * 22,
    y: 232 + Math.floor(i / 6) * 22,
    l: (i * 7 + (i % 5)) % 4,
  }));
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Illustration of a message leaving one peer as plain text, crossing the network as scrambled squares under an AES-256 lock, and arriving at the other peer"
      className="ill block size-full"
    >
      <rect width="960" height="600" fill="var(--bg)" />
      <Peer x={150} y={310} label="sender" />
      <Peer x={810} y={310} label="receiver" />
      <line x1="190" y1="310" x2="770" y2="310" stroke={C} strokeOpacity="0.6" strokeWidth="2.5" />
      <rect
        x="196"
        y="272"
        width="150"
        height="46"
        rx="8"
        fill="var(--surface)"
        stroke="var(--border-2)"
        strokeWidth="2"
      />
      <text x="271" y="302" fontSize="17" fill="var(--text)" textAnchor="middle" style={mono}>
        message
      </text>
      <g className="ill-cipher">
        {cipher.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="18" height="18" rx="3" fill={L[c.l]} />
        ))}
      </g>
      <g transform="translate(480 168)">
        <rect x="-22" y="-4" width="44" height="34" rx="6" fill={C} />
        <path d="M-12 -4 v-12 a12 12 0 0 1 24 0 v12" fill="none" stroke={C} strokeWidth="5" />
        <circle cx="0" cy="12" r="4" fill="var(--bg)" />
      </g>
      <text x="480" y="130" fontSize="22" fill="var(--text)" textAnchor="middle" style={mono}>
        AES-256
      </text>
      <rect
        x="614"
        y="272"
        width="150"
        height="46"
        rx="8"
        fill="var(--surface)"
        stroke="var(--border-2)"
        strokeWidth="2"
      />
      <text x="689" y="302" fontSize="17" fill="var(--text)" textAnchor="middle" style={mono}>
        message
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
          x="60"
          y="130"
          width="260"
          height="260"
          rx="12"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2"
        />
        {[0, 1, 2, 3].map((i) => {
          const x = 76 + (i % 2) * 120;
          const y = 146 + Math.floor(i / 2) * 120;
          return (
            <g key={i}>
              <rect x={x} y={y} width="108" height="108" rx="8" fill="var(--surface-2)" />
              <circle cx={x + 54} cy={y + 42} r="16" fill="none" stroke={C} strokeWidth="2.5" />
              <path d={`M${x + 24} ${y + 98} a30 26 0 0 1 60 0`} fill="none" stroke={C} strokeWidth="2.5" />
            </g>
          );
        })}
        <text x="190" y="436" fontSize="18" fill="var(--text)" textAnchor="middle" style={mono}>
          HD video
        </text>
      </g>
      {/* audio */}
      <g>
        <rect
          x="350"
          y="130"
          width="260"
          height="260"
          rx="12"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2"
        />
        {bars.map((h, i) => (
          <rect
            key={i}
            className="ill-bar"
            style={{ ["--i" as string]: i, transformOrigin: `${376 + i * 18}px 260px` } as CSSProperties}
            x={370 + i * 18}
            y={260 - h}
            width="10"
            height={h * 2}
            rx="5"
            fill={C}
          />
        ))}
        <text x="480" y="436" fontSize="18" fill="var(--text)" textAnchor="middle" style={mono}>
          VoIP audio
        </text>
      </g>
      {/* screen */}
      <g>
        <rect
          x="640"
          y="130"
          width="260"
          height="260"
          rx="12"
          fill="var(--surface)"
          stroke="var(--border-2)"
          strokeWidth="2"
        />
        <rect x="660" y="160" width="220" height="150" rx="8" fill="var(--surface-2)" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x="676"
            y={178 + i * 26}
            width={150 - (i % 2) * 40}
            height="10"
            rx="5"
            fill="var(--border-2)"
          />
        ))}
        <rect x="796" y="262" width="76" height="40" rx="6" fill="var(--bg)" stroke={C} strokeWidth="2.5" />
        <circle cx="834" cy="276" r="7" fill="none" stroke={C} strokeWidth="2" />
        <text x="770" y="436" fontSize="18" fill="var(--text)" textAnchor="middle" style={mono}>
          Screen share + PiP
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
