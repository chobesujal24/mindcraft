import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

const paths = {
  fleet: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17.5 9 5 9-5" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 8 3.5 4L5 16" />
      <path d="M12 16h6" />
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  "arrow-right": <path d="M4 12h15m-5-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H5m5-6-6 6 6 6" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-13.6-4.6L3.5 9" />
      <path d="M3.5 4v5h5" />
      <path d="M4 13a8 8 0 0 0 13.6 4.6l2.9-2.6" />
      <path d="M20.5 20v-5h-5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  command: (
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C4 12 8 5 19 5c1 10-4 15-11 14" />
      <path d="M5 19c2-5 5-8 9-10" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </>
  ),
  zap: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-12H12l1-8Z" />,
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.4-7.5-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3.5C19.5 15.6 12 20 12 20Z" />
  ),
  home: (
    <>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  droplet: <path d="M12 3s6 6.2 6 10.2A6 6 0 0 1 6 13.2C6 9.2 12 3 12 3Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5v11" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20 16 8M14 6l4-4M18 10l4-4M16 4l4 4" />
      <path d="M13 11l-2 2" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M7 6a8 8 0 1 0 10 0" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  filter: <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" />,
  sparkle: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="m6 6 12 12M18 6 6 18" opacity=".35" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  send: <path d="m3 11 18-7-7 18-2.5-8L3 11Z" />,
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M8.5 14h.01M15.5 14h.01M9 17h6" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.5 4.5a11 11 0 0 0 0 15M19.5 19.5a11 11 0 0 0 0-15" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  sword: (
    <>
      <path d="M14 4h6v6L9 21l-3-3L14 4Z" />
      <path d="m6 15 3 3M4 20l2-2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.8 12.2 8.7-8.7M16 7l3 3M14 9l2 2" />
    </>
  ),
  network: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1.5" />
      <rect x="2" y="16" width="6" height="6" rx="1.5" />
      <rect x="16" y="16" width="6" height="6" rx="1.5" />
      <path d="M12 8v4M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 5-5" />
    </>
  ),
  spark: (
    <path d="M12 3.5c.6 4.6 3.9 7.9 8.5 8.5-4.6.6-7.9 3.9-8.5 8.5-.6-4.6-3.9-7.9-8.5-8.5 4.6-.6 7.9-3.9 8.5-8.5Z" />
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.7A10.9 10.9 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a17 17 0 0 1-3.1 3.7M6.2 8.1A16.7 16.7 0 0 0 2.5 12S6 17.5 12 17.5c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.9 9.9A2.9 2.9 0 0 0 14.1 14" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  "volume-x": (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5.5 13.5a10 10 0 0 1 4.2-2.4M14.5 11.2a10 10 0 0 1 4 2.3M2.5 10a15 15 0 0 1 5-3M16.5 7a15 15 0 0 1 5 3" />
      <path d="M12 20h.01" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

const SAKURA_PETALS = [0, 72, 144, 216, 288];

export function SakuraMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="21.4" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.9" />
      <circle cx="24" cy="24" r="18.6" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.5" />
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        {SAKURA_PETALS.map((angle) => (
          <path
            key={angle}
            d="M24 20.9c-2.6-1.8-3.8-5-2.8-7.9.6-1.8 1.8-3 2.2-4.5.1-.4.2-.6.6-.6s.5.2.6.6c.4 1.5 1.6 2.7 2.2 4.5 1 2.9-.2 6.1-2.8 7.9Z"
            fill="currentColor"
            fillOpacity="0.09"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
      </g>
      <circle cx="24" cy="24" r="1.15" fill="currentColor" />
      {SAKURA_PETALS.map((angle) => (
        <circle
          key={`stamen-${angle}`}
          cx="24"
          cy="20.7"
          r="0.48"
          fill="currentColor"
          fillOpacity="0.55"
          transform={`rotate(${angle + 36} 24 24)`}
        />
      ))}
    </svg>
  );
}
