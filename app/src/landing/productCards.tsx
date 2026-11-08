// productCards.tsx — the portal's own screens, drawn small and static, and the
// story that walks through one.
//
// Each screen mirrors something the workspace shows: a deal's thread (offer,
// counter, a paid change, the review), a brand's "Needs you" list, the
// pitches on a brief. They carry no brand or creator names: they show how
// it works, not who uses it. The shell and the story are here; each page's
// own screens are in cards-creators.tsx and cards-brands.tsx, so neither page
// downloads the other's.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Brand, CheckMark } from './components';
import { WIDE_MOTION } from './motion';

/** The workspace shell: the sidebar as the portal draws it, and one screen. */
export function Window({ persona, nav, active, crumb, title, children }: {
  persona: 'creator' | 'brand'; nav: string[]; active: string; crumb: string; title: string; children: ReactNode;
}) {
  return (
    <div className="lx-window" data-persona={persona} role="group" aria-label={`Example: the ${active} screen in the workspace`}>
      <aside className="lx-window-side" aria-hidden="true">
        <Brand />
        {nav.map((n) => <span key={n} className={n === active ? 'lx-window-nav on' : 'lx-window-nav'}>{n}</span>)}
      </aside>
      <div className="lx-window-main">
        <div className="lx-window-top">
          <div><div className="lx-window-crumb">{crumb}</div><div className="lx-window-title">{title}</div></div>
          <span className="lx-pill">Example</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface WorkspaceScreen { persona: 'creator' | 'brand'; nav: string[]; active: string; crumb: string; title: string; rows: ReactNode[] }

/** How deals run today, beside how the workspace runs them. Every "now" is
 *  something the product does today; every "was" is the status quo it
 *  replaces, not a competitor.
 *
 *  At rest it's a plain list and the whole screen. On a wide screen it pins
 *  and plays: each step of scrolling takes one line out of the DMs and files
 *  it as a row of the deal. */
export function DealStory({ id, title, lead, before, steps, screen }: {
  id: string; title: string; lead: string; before: string; steps: [was: string, now: string][]; screen: WorkspaceScreen;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [step, setStep] = useState(0);
  const count = steps.length;
  useEffect(() => {
    const el = track.current;
    if (!el || typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia(WIDE_MOTION);
    let frame = 0;
    const read = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const through = -r.top / Math.max(1, r.height - window.innerHeight);
      setStep(Math.min(count - 1, Math.max(0, Math.floor(through * count))));
    };
    const onScroll = () => { frame ||= requestAnimationFrame(read); };
    const sync = () => { setLive(wide.matches); read(); };
    sync();
    wide.addEventListener('change', sync);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); wide.removeEventListener('change', sync); window.removeEventListener('scroll', onScroll); };
  }, [count]);
  const stateOf = (i: number) => (!live ? undefined : i === step ? 'now' : i < step ? 'done' : 'next');
  return (
    <section className="lx-sheet lx-story lx-dark" id={id} data-sheet aria-labelledby={`${id}-title`}>
      <div ref={track} className={live ? 'lx-story-track is-live' : 'lx-story-track'} style={{ '--steps': count } as CSSProperties}>
        <div className="lx-story-stage">
          <div className="lx-wrap lx-story-grid">
            <div className="lx-story-copy">
              <h2 className="lx-h2 md" id={`${id}-title`}>{title}</h2>
              <p className="lx-lead">{lead}</p>
              {live && <div className="lx-ticks" aria-hidden="true">{steps.map(([, now], i) => <i key={now} data-on={i <= step || undefined} />)}</div>}
              <ol className="lx-steps">
                {steps.map(([was, now], i) => (
                  <li key={now} data-state={stateOf(i)}>
                    <p className="lx-was"><span className="lx-was-from">{before}</span>{was}</p>
                    <p className="lx-now"><CheckMark /><span><span className="lx-sr">On Alamut: </span>{now}</span></p>
                  </li>
                ))}
              </ol>
            </div>
            <Window persona={screen.persona} nav={screen.nav} active={screen.active} crumb={screen.crumb} title={screen.title}>
              {screen.rows.map((row, i) => <div key={i} className="lx-card lx-step-row" data-state={stateOf(i)}>{row}</div>)}
            </Window>
          </div>
        </div>
      </div>
    </section>
  );
}
