const C = "var(--id-golden-verdict)";
const ROLES = ["Customer", "Partner", "Manager", "Admin"];
const STEPS = ["Buy", "Upload", "Track", "Update"];

/** Browser frame: role switcher on the left, request status timeline on the right. */
export function GoldenVerdictSketch({ live = false }: { live?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label="Sketch of a legal-services dashboard with a role switcher and a request timeline"
      className={`sketch ${live ? "sketch-live" : ""} h-auto w-full`}
    >
      <rect x="8" y="8" width="304" height="184" rx="8" fill="var(--bg)" stroke="var(--border)" />
      <rect x="8" y="8" width="304" height="26" rx="8" fill="var(--surface)" />
      <rect x="8" y="26" width="304" height="8" fill="var(--surface)" />
      <line x1="8" y1="34" x2="312" y2="34" stroke="var(--border)" />
      {[22, 34, 46].map((x) => (
        <circle key={x} cx={x} cy="21" r="3" fill="none" stroke="var(--border-2)" />
      ))}
      <rect x="64" y="14" width="150" height="14" rx="7" fill="var(--bg)" stroke="var(--border)" />
      <text x="139" y="24" textAnchor="middle" fontSize="8" fontFamily="var(--font-mono)" fill="var(--muted)">
        goldenverdict.com
      </text>

      {/* sidebar: role switcher */}
      <line x1="92" y1="34" x2="92" y2="192" stroke="var(--border)" />
      <g>
        {ROLES.map((_, i) => (
          <rect
            key={i}
            className="sk-gv-role"
            x="18"
            y={46 + i * 30}
            width="64"
            height="22"
            rx="11"
            fill="var(--surface-2)"
            stroke="var(--border)"
          />
        ))}
      </g>
      <g fontSize="8" fontFamily="var(--font-mono)" fill="var(--text)" textAnchor="middle">
        {ROLES.map((r, i) => (
          <text key={r} x="50" y={60 + i * 30}>
            {r}
          </text>
        ))}
      </g>

      {/* main: request header + timeline */}
      <rect x="108" y="46" width="70" height="8" rx="4" fill={C} />
      <rect x="184" y="46" width="48" height="8" rx="4" fill="var(--surface-2)" />
      <text x="108" y="76" fontSize="8" fontFamily="var(--font-mono)" fill="var(--muted)">
        REQ-····
      </text>
      <line x1="124" y1="116" x2="288" y2="116" stroke="var(--border)" strokeWidth="2" />
      <line className="sk-gv-progress" x1="124" y1="116" x2="288" y2="116" stroke={C} strokeWidth="2" />
      <g>
        {STEPS.map((_, i) => (
          <circle
            key={i}
            className="sk-gv-step"
            cx={124 + i * 54.7}
            cy="116"
            r="6"
            fill="var(--surface-2)"
            stroke="var(--border-2)"
            strokeWidth="1.5"
          />
        ))}
      </g>
      <g fontSize="8" fontFamily="var(--font-mono)" fill="var(--muted)" textAnchor="middle">
        {STEPS.map((s, i) => (
          <text key={s} x={124 + i * 54.7} y="136">
            {s}
          </text>
        ))}
      </g>
      <rect x="108" y="156" width="180" height="6" rx="3" fill="var(--surface-2)" />
      <rect x="108" y="168" width="120" height="6" rx="3" fill="var(--surface-2)" />
    </svg>
  );
}
