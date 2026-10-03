const C = "var(--id-lansymphony)";
const NODES = [
  { x: 160, y: 52 },
  { x: 76, y: 150 },
  { x: 244, y: 150 },
];

/** Three peers discover each other on the LAN; an encrypted packet travels between them. */
export function LanSymphonySketch({ live = false }: { live?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label="Sketch of three peers discovering each other on a local network while an encrypted packet moves between them"
      className={`sketch ${live ? "sketch-live" : ""} h-auto w-full`}
    >
      <rect x="8" y="8" width="304" height="184" rx="8" fill="var(--bg)" stroke="var(--border)" />
      <g stroke={C} strokeOpacity="0.55" strokeWidth="1.5" fill="none">
        <line className="sk-ls-link" x1={NODES[0]!.x} y1={NODES[0]!.y} x2={NODES[1]!.x} y2={NODES[1]!.y} />
        <line className="sk-ls-link" x1={NODES[1]!.x} y1={NODES[1]!.y} x2={NODES[2]!.x} y2={NODES[2]!.y} />
        <line className="sk-ls-link" x1={NODES[2]!.x} y1={NODES[2]!.y} x2={NODES[0]!.x} y2={NODES[0]!.y} />
      </g>
      {NODES.map((n, i) => (
        <g key={i}>
          <circle className="sk-ls-ring" cx={n.x} cy={n.y} r="14" fill="none" stroke={C} strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r="14" fill="var(--surface)" stroke={C} strokeWidth="1.5" />
          <rect
            x={n.x - 6}
            y={n.y - 5}
            width="12"
            height="8"
            rx="1.5"
            fill="none"
            stroke="var(--text)"
            strokeWidth="1.2"
          />
          <line x1={n.x - 3} y1={n.y + 6} x2={n.x + 3} y2={n.y + 6} stroke="var(--text)" strokeWidth="1.2" />
        </g>
      ))}
      <text x="160" y="22" fontSize="8" fontFamily="var(--font-mono)" fill="var(--muted)" textAnchor="middle">
        no server · no internet
      </text>
      <g className="sk-ls-packet">
        <rect x="-15" y="-9" width="30" height="18" rx="4" fill={C} />
        <text
          x="0"
          y="3.5"
          fontSize="8"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fill="var(--bg)"
          textAnchor="middle"
        >
          AES
        </text>
      </g>
    </svg>
  );
}
