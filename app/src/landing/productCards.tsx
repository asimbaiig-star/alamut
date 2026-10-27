// productCards.tsx — the portal's own screens, drawn small and static.
//
// Each mirrors something the workspace shows: a deal's thread (offer,
// counter, a paid change, the review), a brand's "Needs you" list, the
// pitches on a brief. They carry no brand or creator names: they show how
// it works, not who uses it. The shell and the comparison are here; each
// page's own screens are in cards-creators.tsx and cards-brands.tsx, so
// neither page downloads the other's.

import type { ReactNode } from 'react';
import { Brand, CheckMark } from './components';

/** The workspace shell: the sidebar as the portal draws it, and one screen. */
export function Window({ nav, active, crumb, title, children }: {
  nav: string[]; active: string; crumb: string; title: string; children: ReactNode;
}) {
  return (
    <div className="lx-window" aria-label={`Example: the ${active} screen in the workspace`}>
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

/** The way it's done now, beside the way the workspace does it. Every
 *  right-hand cell is something the product does today; the left is the
 *  status quo it replaces, not a competitor. */
export function Compare({ caption, before, rows }: {
  caption: string; before: string; rows: [string, string][];
}) {
  return (
    <div className="lx-compare-wrap">
      <table className="lx-compare">
        <caption className="lx-sr">{caption}</caption>
        <thead>
          <tr><th scope="col">{before}</th><th scope="col">On Alamut</th></tr>
        </thead>
        <tbody>
          {rows.map(([was, now]) => (
            <tr key={now}>
              <td data-label={before}>{was}</td>
              <td data-label="On Alamut"><span className="lx-compare-now"><CheckMark /><span>{now}</span></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
