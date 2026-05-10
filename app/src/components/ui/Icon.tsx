// Icon library — inline SVGs ported from prototype Icon namespace.
// All icons use currentColor and accept `s` (size) prop.

interface IconProps { s?: number; className?: string }

const wrap = (s: number | undefined, children: React.ReactNode, label?: string) => (
  <svg width={s ?? 16} height={s ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-label={label}>
    {children}
  </svg>
);

export const Icon = {
  arrow: ({ s }: IconProps) => wrap(s, <><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></>),
  back: ({ s }: IconProps) => wrap(s, <><path d="M19 12H5" /><path d="m11 5-7 7 7 7" /></>),
  x: ({ s }: IconProps) => wrap(s, <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>),
  check: ({ s }: IconProps) => wrap(s, <path d="M20 6 9 17l-5-5" />),
  plus: ({ s }: IconProps) => wrap(s, <><path d="M12 5v14" /><path d="M5 12h14" /></>),
  minus: ({ s }: IconProps) => wrap(s, <path d="M5 12h14" />),
  search: ({ s }: IconProps) => wrap(s, <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  spark: ({ s }: IconProps) => wrap(s, <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2z" />),
  bell: ({ s }: IconProps) => wrap(s, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>),
  home: ({ s }: IconProps) => wrap(s, <><path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></>),
  compass: ({ s }: IconProps) => wrap(s, <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" /></>),
  layers: ({ s }: IconProps) => wrap(s, <><path d="m12 2 10 6-10 6L2 8z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>),
  film: ({ s }: IconProps) => wrap(s, <><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></>),
  inbox: ({ s }: IconProps) => wrap(s, <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>),
  wallet: ({ s }: IconProps) => wrap(s, <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 1 0 0 4h4v-4z" /></>),
  chart: ({ s }: IconProps) => wrap(s, <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-7" /></>),
  user: ({ s }: IconProps) => wrap(s, <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  users: ({ s }: IconProps) => wrap(s, <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  briefcase: ({ s }: IconProps) => wrap(s, <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  building: ({ s }: IconProps) => wrap(s, <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></>),
  download: ({ s }: IconProps) => wrap(s, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  upload: ({ s }: IconProps) => wrap(s, <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>),
  out: ({ s }: IconProps) => wrap(s, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  dot: ({ s }: IconProps) => wrap(s ?? 8, <circle cx="12" cy="12" r="6" fill="currentColor" />),
  mail: ({ s }: IconProps) => wrap(s, <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  lock: ({ s }: IconProps) => wrap(s, <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  link: ({ s }: IconProps) => wrap(s, <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
};

export type IconName = keyof typeof Icon;
