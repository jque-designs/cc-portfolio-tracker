import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const IconSearch = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IconWallet = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" />
    <circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconOut = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 16 16 8M9.5 8H16v6.5" />
  </svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </svg>
);
export const IconSun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);
export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
  </svg>
);
export const IconAuto = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m7 10 5 5 5-5" />
  </svg>
);
export const IconSortDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 5v14m0 0-3-3m3 3 3-3M13 7h7M13 12h5M13 17h3" />
  </svg>
);
export const IconSortUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 19V5m0 0L4 8m3-3 3 3M13 7h3M13 12h5M13 17h7" />
  </svg>
);
export const IconArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

/** Filled triangle used in change pills; points down when `down`. */
export const Tri = ({ down }: { down?: boolean }) => (
  <svg viewBox="0 0 12 12" aria-hidden style={down ? { transform: "rotate(180deg)" } : undefined}>
    <path d="M6 2.5 10.5 9.5h-9Z" fill="currentColor" />
  </svg>
);

export const Pokeball = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M2.6 11.2a9.5 9.5 0 0 1 18.8 0H15a3 3 0 0 0-6 0Z" fill="var(--accent)" />
    <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M2.5 12H9M15 12h6.5" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const StarBall = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="#f59e0b" />
    <circle cx="9" cy="8.5" r="2.2" fill="#fde68a" opacity="0.8" />
    <path d="m12 8.6 1.1 2.3 2.5.3-1.8 1.7.5 2.5L12 14.2l-2.3 1.2.5-2.5-1.8-1.7 2.5-.3Z" fill="#dc2626" />
  </svg>
);
