// Tiny CSS-only charts for audience demographics. No deps.
import type { AudienceDemographics } from '@/lib/api/types';

export function AgeBars({ data }: { data: AudienceDemographics['ageBuckets'] }) {
  const order: (keyof AudienceDemographics['ageBuckets'])[] = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
  const max = Math.max(...order.map((k) => data[k] || 0), 0.01);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map((k) => {
        const v = data[k] || 0;
        if (v === 0 && k === '13-17') return null;
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <span className="mono-meta">{k}</span>
            <div style={{ height: 8, background: 'var(--paper-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: 'var(--ink)' }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-80)', textAlign: 'right' }}>{Math.round(v * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function GenderSplit({ data }: { data: AudienceDemographics['genderSplit'] }) {
  const total = data.female + data.male + data.other;
  const f = (data.female / total) * 100;
  const m = (data.male / total) * 100;
  const o = (data.other / total) * 100;
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--paper-2)', marginBottom: 10 }}>
        <div style={{ width: `${f}%`, background: 'var(--accent)' }} title={`Female ${f.toFixed(0)}%`} />
        <div style={{ width: `${m}%`, background: 'var(--ink-80)' }} title={`Male ${m.toFixed(0)}%`} />
        <div style={{ width: `${o}%`, background: 'var(--ink-40)' }} title={`Other ${o.toFixed(0)}%`} />
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--ink-80)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} />
          Female · {Math.round(f)}%
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ink-80)' }} />
          Male · {Math.round(m)}%
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ink-40)' }} />
          Other · {Math.round(o)}%
        </span>
      </div>
    </div>
  );
}

export function GeoList({ data }: { data: AudienceDemographics['topCountries'] }) {
  const max = Math.max(...data.map((d) => d.pct), 0.01);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((c) => (
        <div key={c.country} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 44px', gap: 10, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--ink-80)' }}>{c.country}</span>
          <div style={{ height: 6, background: 'var(--paper-2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(c.pct / max) * 100}%`, height: '100%', background: 'var(--ink)' }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-80)', textAlign: 'right' }}>{Math.round(c.pct * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export function CredibilityBadge({ score, suspicious }: { score: number; suspicious: number }) {
  const tone = score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
  const colour = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--bad)';
  const bg     = tone === 'good' ? 'var(--good-bg)' : tone === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)';
  return (
    <div style={{ background: bg, padding: '12px 14px', borderRadius: 6, border: '1px solid transparent' }}>
      <div className="mono-meta" style={{ color: colour }}>Audience credibility</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: colour, fontWeight: 500 }}>{score}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-80)' }}>/ 100</div>
      </div>
      <div className="mono-meta" style={{ marginTop: 4 }}>{suspicious}% suspicious followers</div>
    </div>
  );
}
