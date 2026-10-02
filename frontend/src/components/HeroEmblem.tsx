import { useId } from "react";

/** --color-gold (SVG attributes can't use the Tailwind theme). */
const GOLD = "#d4a72c";
/** --color-logo: the background of public/logo.png. */
const FIELD = "#3a0000";

// Geometry in a 400×400 view box, from the centre outwards.
const C = 200;
const LOGO_SIZE = 236; // the white horse disc is ~92% of the image's half-width: radius ~108
const FIELD_R = 120;
const LEGEND_R = 138; // text baseline
const RING_R = 156;
const REEDING_R = 163;
const GLOW_R = 200;

interface HeroEmblemProps {
  /** Text set around the rim like a coin legend. */
  legend: string;
  className?: string;
}

/**
 * The logo struck like a coin: the horse on its field, a gold rim with a milled edge and a
 * legend that turns very slowly (still for visitors who prefer reduced motion).
 */
export function HeroEmblem({ legend, className = "" }: HeroEmblemProps) {
  const id = useId();
  const glowId = `${id}-glow`;
  const clipId = `${id}-clip`;
  const legendPathId = `${id}-legend`;
  const circumference = 2 * Math.PI * LEGEND_R;

  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="55%" stopColor={GOLD} stopOpacity="0.16" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx={C} cy={C} r={FIELD_R} />
        </clipPath>
        {/* A full circle starting at the top, clockwise, for the legend. */}
        <path
          id={legendPathId}
          d={`M ${C},${C - LEGEND_R} a ${LEGEND_R},${LEGEND_R} 0 1,1 0,${2 * LEGEND_R} a ${LEGEND_R},${LEGEND_R} 0 1,1 0,${-2 * LEGEND_R}`}
        />
      </defs>

      <circle cx={C} cy={C} r={GLOW_R} fill={`url(#${glowId})`} />

      {/* Rim: milled edge, outer and inner rings. */}
      <circle cx={C} cy={C} r={RING_R + 14} fill={FIELD} />
      <circle cx={C} cy={C} r={REEDING_R} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="7" strokeDasharray="1.2 3.2" />
      <circle cx={C} cy={C} r={RING_R + 12} fill="none" stroke={GOLD} strokeOpacity="0.8" strokeWidth="1.5" />
      <circle cx={C} cy={C} r={RING_R} fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1" />

      <g
        className="animate-[spin_160s_linear_infinite] motion-reduce:animate-none"
        style={{ transformOrigin: `${C}px ${C}px` }}
      >
        <text
          fill={GOLD}
          fontSize="13"
          fontWeight="600"
          letterSpacing="2"
          style={{ textTransform: "uppercase" }}
        >
          <textPath href={`#${legendPathId}`} textLength={circumference - 6} lengthAdjust="spacing">
            {legend}
          </textPath>
        </text>
      </g>

      {/* Field with the logo. */}
      <circle cx={C} cy={C} r={FIELD_R} fill={FIELD} />
      <image
        href="/logo.png"
        x={C - LOGO_SIZE / 2}
        y={C - LOGO_SIZE / 2}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        clipPath={`url(#${clipId})`}
      />
      <circle cx={C} cy={C} r={FIELD_R} fill="none" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1.5" />
    </svg>
  );
}
