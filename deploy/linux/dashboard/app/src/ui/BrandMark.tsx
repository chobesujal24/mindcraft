import { useId } from "react";

/**
 * The Yozakura seal: a vermilion hanko square with a five-petal sakura
 * cut from it. The cut-outs are transparent, so the mark sits correctly
 * on ink, washi, dialogs, and the browser tab alike.
 */
const PETAL =
  "M20 20C17.4 17.8 15.9 13.6 17.2 9.5L19 10.9L20 12.1L21 10.9L22.8 9.5C24.1 13.6 22.6 17.8 20 20Z";

export function BrandMark({
  size = 32,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const rawId = useId();
  const maskId = `yz-seal-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Yozakura seal"}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <defs>
        <mask id={maskId}>
          <rect width="40" height="40" fill="#fff" />
          <g fill="#000">
            {[0, 72, 144, 216, 288].map((angle) => (
              <path key={angle} d={PETAL} transform={`rotate(${angle} 20 20)`} />
            ))}
            <circle cx="20" cy="20" r="2.1" />
          </g>
        </mask>
      </defs>
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="2.6"
        fill="var(--accent)"
        mask={`url(#${maskId})`}
      />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="2.6"
        fill="none"
        stroke="var(--accent-hi)"
        strokeOpacity="0.4"
        strokeWidth="0.7"
      />
    </svg>
  );
}
