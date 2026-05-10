// ComingSoon.tsx — placeholder surface for v2 screens not yet built.
// Used so every nav item lands somewhere coherent rather than 404'ing
// while the rest of the system gets implemented.

import { Topbar, Icon } from '../lib';

interface Props {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export function ComingSoon({ title, subtitle, eyebrow = 'Coming next' }: Props) {
  return (
    <>
      <Topbar title={title} crumb={eyebrow} />
      <div className="v2-content">
        <div
          className="v2-card v2-card-pad-lg"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '80px 40px',
            gap: 16,
            background: 'linear-gradient(135deg, var(--v2-paper) 0%, var(--v2-bg-2) 100%)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--v2-accent-soft)',
              color: 'var(--v2-accent)',
            }}
          >
            {Icon.spark}
          </div>
          <div className="v2-eyebrow">{eyebrow}</div>
          <h2
            style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: '-0.025em',
              margin: 0,
              color: 'var(--v2-ink)',
            }}
          >{title}</h2>
          <p
            style={{
              maxWidth: 560,
              margin: 0,
              color: 'var(--v2-ink-2)',
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >{subtitle}</p>
          <div className="v2-row" style={{ gap: 8, marginTop: 8 }}>
            <button className="v2-btn v2-btn-primary" type="button">
              Notify me when it ships
            </button>
            <button className="v2-btn v2-btn-outline" type="button">
              Read the design spec
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
