import { useId } from "react";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
  strokeWidth?: number;
};

export function Sparkline({
  data,
  width = 180,
  height = 44,
  label = "Trend",
  className,
  strokeWidth = 1.4,
}: SparklineProps) {
  const id = useId().replace(/:/g, "");
  const safe = data.filter((value) => Number.isFinite(value));
  const values = safe.length > 1 ? safe : [0, 0];
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const flat = max - min < 0.000001;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((value, index) => {
    const x = pad + index * step;
    const y = flat ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, Math.max(pad, Math.min(height - pad, y))] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(2)} ${height} L${points[0][0].toFixed(2)} ${height} Z`;

  return (
    <svg
      className={className ? `sparkline ${className}` : "sparkline"}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={`spark-${id}`}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#spark-${id})`}>
        <path className="sparkline__area" d={area} />
        <path className="sparkline__line" d={line} strokeWidth={strokeWidth} pathLength={1} />
      </g>
    </svg>
  );
}
