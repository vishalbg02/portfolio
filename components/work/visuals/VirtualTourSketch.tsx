const C = "var(--id-virtual-tour)";
// Resting positions (0°, 120°, 240° on the ring) used when animation is off (reduced motion).
const HOTSPOT_REST = ["translate(264px, 100px)", "translate(108px, 127.7px)", "translate(108px, 72.3px)"];

/** A 360° panorama ring with hotspots circling it. */
export function VirtualTourSketch({ live = false }: { live?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label="Sketch of a 360-degree panorama ring with interactive hotspots"
      className={`sketch ${live ? "sketch-live" : ""} h-auto w-full`}
    >
      <rect x="8" y="8" width="304" height="184" rx="8" fill="var(--bg)" stroke="var(--border)" />
      <ellipse
        cx="160"
        cy="100"
        rx="104"
        ry="32"
        fill="none"
        stroke={C}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <ellipse
        className="sk-vt-ticks"
        cx="160"
        cy="100"
        rx="104"
        ry="32"
        fill="none"
        stroke={C}
        strokeWidth="5"
        strokeDasharray="2 22"
      />
      <ellipse cx="160" cy="100" rx="64" ry="20" fill="none" stroke="var(--border-2)" strokeDasharray="3 4" />
      <circle cx="160" cy="100" r="22" fill="var(--surface)" stroke={C} strokeWidth="1.5" />
      <text
        x="160"
        y="104"
        fontSize="11"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        fill="var(--text)"
        textAnchor="middle"
      >
        360°
      </text>
      {/* hotspots: drawn at the origin, positioned by the orbit keyframes */}
      {HOTSPOT_REST.map((pos, i) => (
        <g key={i} className="sk-vt-hotspot" style={{ transform: pos }}>
          <circle r="9" fill={C} fillOpacity="0.2" />
          <circle r="4" fill={C} />
        </g>
      ))}
      <g fill="var(--surface-2)">
        <rect x="24" y="166" width="90" height="6" rx="3" />
        <rect x="206" y="166" width="90" height="6" rx="3" />
      </g>
      <g fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M150 170 l-5 3 l5 3" />
        <path d="M170 170 l5 3 l-5 3" />
      </g>
    </svg>
  );
}
