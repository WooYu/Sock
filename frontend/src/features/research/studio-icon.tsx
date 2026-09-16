import type { CSSProperties } from 'react'

const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
  chart: <><path d="M5 3v17M2 8h6v7H2M17 3v18m-3-15h6v10h-6" /></>,
  book: <><path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3ZM12 6v15M6 8h3m6 0h3M6 12h3m6 0h3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  pointer: <path d="m5 3 13 9-7 1-4 6Z" />,
  pan: <><path d="M12 3v18M3 12h18M9 6l3-3 3 3M6 9l-3 3 3 3m12-6 3 3-3 3m-9 3 3 3 3-3" /></>,
  'trend-line': <><path d="M5 18 19 5" /><rect x="2" y="17" width="4" height="4" /><rect x="18" y="2" width="4" height="4" /></>,
  'horizontal-line': <><path d="M2 12h20" /><circle cx="9" cy="12" r="2" /></>,
  rectangle: <rect x="4" y="5" width="16" height="14" rx="1" />,
  text: <path d="M4 5h16M12 5v15M8 20h8M4 5v3m16-3v3" />,
  buy: <><path d="m7 9 5-5 5 5M12 4v13M5 21h14" /></>,
  sell: <><path d="m7 12 5 5 5-5M12 4v13M5 21h14" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M1 12h4m14 0h4" /></>,
  'stop-loss': <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM8 12h8" /></>,
  crosshair: <><circle cx="12" cy="12" r="5" /><path d="M12 2v5m0 10v5M2 12h5m10 0h5" /></>,
  undo: <><path d="m8 4-5 5 5 5M3 9h12a6 6 0 0 1 0 12" /></>,
  redo: <><path d="m16 4 5 5-5 5m5-5H9a6 6 0 0 0 0 12" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></>,
} as const

export function StudioIcon({ name, size = 18, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>
}
