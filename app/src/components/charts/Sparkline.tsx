// Tiny inline-SVG sparkline. Pure presentational — takes a values array,
// renders a smooth path, optional area fill, optional dot at the latest
// value, optional today-highlight marker.
//
// Sized to its container via 100% width; the SVG uses preserveAspectRatio
// so it scales cleanly inside any tile.

import type { CSSProperties } from 'react';

interface Props {
  values: number[];
  width?: number;       // target width in px (used for viewBox math)
  height?: number;      // target height in px
  /** Show a small filled circle at the latest point. */
  showLast?: boolean;
  /** Show a soft accent gradient under the line. Default true. */
  area?: boolean;
  /** Override the stroke colour. Defaults to var(--accent). */
  color?: string;
  /** Inline style override. */
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
}

export function Sparkline({
  values, width = 320, height = 64,
  showLast = true, area = true,
  color = 'var(--accent)',
  style, className,
  ariaLabel = 'Sparkline',
}: Props) {
  if (values.length === 0) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={style} aria-label={ariaLabel}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--ink-40)" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      </svg>
    );
  }

  const padX = 4;
  const padY = 6;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;

  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);

  const xAt = (i: number) =>
    values.length === 1 ? padX + innerW / 2 : padX + (i / (values.length - 1)) * innerW;
  const yAt = (v: number) =>
    padY + (1 - (v - min) / range) * innerH;

  // Build a smoothed path using cubic Bezier — creates the editorial
  // hand-drawn feel without going full curve-fitting.
  let path = `M ${xAt(0).toFixed(2)} ${yAt(values[0]).toFixed(2)}`;
  for (let i = 1; i < values.length; i++) {
    const px = xAt(i - 1);
    const py = yAt(values[i - 1]);
    const x = xAt(i);
    const y = yAt(values[i]);
    const cx1 = (px + x) / 2;
    const cy1 = py;
    const cx2 = (px + x) / 2;
    const cy2 = y;
    path += ` C ${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  const lastX = xAt(values.length - 1);
  const lastY = yAt(values[values.length - 1]);

  // Area fill = path traced down to baseline + back to start
  const baseY = yAt(0); // y for value 0 within current range
  const areaPath = `${path} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${xAt(0).toFixed(2)} ${baseY.toFixed(2)} Z`;
  const gradId = `spark-grad-${Math.round(Math.random() * 1e9)}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {showLast && (
        <>
          <circle cx={lastX} cy={lastY} r={4.5} fill={color} opacity={0.18} />
          <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
        </>
      )}
    </svg>
  );
}
