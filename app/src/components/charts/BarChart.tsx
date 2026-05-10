// Editorial bar chart — minimal SVG, no dependencies.
// Designed to fit the existing typography + token system.
import { fmtCount } from '@/lib/utils/format';

export interface BarDatum {
  label: string;
  value: number;
  // Optional: secondary value displayed under the label (e.g. brand name).
  sub?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  // Optional formatter for the bar value tooltip / axis label
  format?: (n: number) => string;
}

export function BarChart({ data, height = 200, format }: BarChartProps) {
  if (!data.length) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', fontSize: 13, color: 'var(--ink-60)' }}>
        Not enough data to chart yet.
      </div>
    );
  }

  const fmt = format || fmtCount;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${data.length}, 1fr)`,
          gap: 8,
          alignItems: 'flex-end',
          padding: '8px 4px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={i}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                position: 'relative',
              }}
              title={`${d.label} · ${fmt(d.value)}`}
            >
              <span
                className="bar-chart-value"
                style={{
                  fontFamily: 'var(--mono)', fontSize: 10,
                  color: 'var(--ink-60)', marginBottom: 4,
                  letterSpacing: '0.04em',
                  opacity: pct < 8 ? 0 : 1,
                }}
              >
                {fmt(d.value)}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 36,
                  height: `${Math.max(pct, 2)}%`,
                  background: pct === 100
                    ? 'var(--accent)'
                    : 'var(--ink)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 360ms cubic-bezier(.22,.8,.15,1)',
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${data.length}, 1fr)`,
          gap: 8,
          padding: '8px 4px 0',
        }}
      >
        {data.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--ink-80)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {d.label}
            </div>
            {d.sub && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-40)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
