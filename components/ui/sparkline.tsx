interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  /** Fill area under the line */
  fill?: boolean;
}

/**
 * Minimal SVG sparkline — no dependencies, works in server and client components.
 * Uses viewBox + width="100%" so it stretches to its container.
 * vectorEffect="non-scaling-stroke" keeps stroke at 1.5px regardless of stretch.
 */
export function Sparkline({ data, color = "#f59e0b", height = 28, fill = true }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const W = 100; // virtual viewBox width units
  const H = height;
  const pad = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);

  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      {fill && (
        <defs>
          <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
      )}
      {fill && (
        <path
          d={area}
          fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, "")})`}
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
