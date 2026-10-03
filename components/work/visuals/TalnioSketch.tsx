const C = "var(--id-talnio)";

/** Phone frame: geofenced map with a bouncing pin and a pulsing check-in button, plus NFC arcs. */
export function TalnioSketch({ live = false }: { live?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label="Sketch of a phone showing an attendance check-in with a map pin"
      className={`sketch ${live ? "sketch-live" : ""} h-auto w-full`}
    >
      <rect x="8" y="8" width="304" height="184" rx="8" fill="var(--bg)" stroke="var(--border)" />

      {/* left: list rows (web dashboard hint) */}
      <g fill="var(--surface-2)">
        <rect x="24" y="30" width="72" height="8" rx="4" fill={C} />
        <rect x="24" y="52" width="88" height="6" rx="3" />
        <rect x="24" y="66" width="64" height="6" rx="3" />
        <rect x="24" y="92" width="88" height="6" rx="3" />
        <rect x="24" y="106" width="72" height="6" rx="3" />
        <rect x="24" y="132" width="88" height="6" rx="3" />
        <rect x="24" y="146" width="56" height="6" rx="3" />
      </g>

      {/* phone */}
      <rect
        x="122"
        y="18"
        width="88"
        height="164"
        rx="14"
        fill="var(--surface)"
        stroke="var(--border-2)"
        strokeWidth="1.5"
      />
      <rect x="152" y="24" width="28" height="5" rx="2.5" fill="var(--border)" />
      <rect x="130" y="36" width="72" height="68" rx="6" fill="var(--bg)" stroke="var(--border)" />
      {/* map: roads + geofence */}
      <g stroke="var(--border)" strokeWidth="1.5" fill="none">
        <path d="M130 62 L202 54" />
        <path d="M150 36 L158 104" />
        <path d="M184 36 L178 104" />
      </g>
      <circle cx="166" cy="72" r="20" fill={C} fillOpacity="0.12" stroke={C} strokeDasharray="3 3" />
      <g className="sk-tn-pin">
        <path d="M166 80 c-6 -8 -9 -12 -9 -17 a9 9 0 1 1 18 0 c0 5 -3 9 -9 17z" fill={C} />
        <circle cx="166" cy="63" r="3" fill="var(--bg)" />
      </g>
      {/* check-in button */}
      <circle className="sk-tn-pulse" cx="166" cy="140" r="16" fill="none" stroke={C} strokeWidth="2" />
      <circle cx="166" cy="140" r="16" fill={C} />
      <path
        d="M158 140 l6 6 l11 -12"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="140" y="166" width="52" height="5" rx="2.5" fill="var(--surface-2)" />

      {/* right: NFC arcs */}
      <g fill="none" stroke={C} strokeWidth="2.5" strokeLinecap="round">
        <path className="sk-tn-nfc" d="M236 84 a22 22 0 0 1 0 32" />
        <path className="sk-tn-nfc" d="M248 74 a38 38 0 0 1 0 52" />
        <path className="sk-tn-nfc" d="M260 64 a54 54 0 0 1 0 72" />
      </g>
      <text x="236" y="152" fontSize="9" fontFamily="var(--font-mono)" fill="var(--muted)">
        NFC
      </text>
    </svg>
  );
}
