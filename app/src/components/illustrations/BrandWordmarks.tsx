// BrandWordmarks · §5.7 placeholder pass
//
// Pre-§5.7 this component rendered the brand name itself in a stylized
// typographic treatment per brand (apothecary serif for Aesop, Scandi-
// bold sans for Hay, etc.). The audit flagged that as IP-adjacent —
// real brand names rendered in distinctive typography read as
// quasi-logos to a casual viewer.
//
// Post-§5.7: every call site renders an abstract geometric mark via
// `<AbstractMark seed={name}>`. The seed is the brand name string so
// the same brand always renders the same shape across surfaces (trust
// strip, marquee, product mocks, etc.) — visual continuity without
// the IP question.
//
// The legacy per-treatment CSS classes (.bw-aesop, .bw-le-creuset, ...)
// stay in landing.css for the wrapper sizing context but no longer
// affect the rendered glyph (the inner content is an SVG, not text).
//
// API is unchanged — `BrandWordmark name="..." className="..." />` —
// so call sites don't need to change. When design lands real
// illustrations, replace the AbstractMark inside this file with the
// new component and every surface updates at once.

import type { CSSProperties } from 'react';
import { AbstractMark } from './AbstractMark';

interface MarkProps {
  className?: string;
  style?: CSSProperties;
}

// Map kept for backwards-compat at the wrapper class level. The
// inner glyph is variant-selected from a hash of the name, so the
// classes here only set wrapper sizing.
const TREATMENTS: Record<string, string> = {
  'Aesop':       'bw-aesop',
  'Le Creuset':  'bw-le-creuset',
  'Muji':        'bw-muji',
  'Patagonia':   'bw-patagonia',
  'Khaadi':      'bw-khaadi',
  'Kinfolk':     'bw-kinfolk',
  'Glossier':    'bw-glossier',
  'Hay':         'bw-hay',
  'Sonos':       'bw-sonos',
  'Marriott':    'bw-marriott',
  'HelloFresh':  'bw-hellofresh',
  'Clinique':    'bw-clinique',
  'Le Labo':     'bw-le-labo',
  'Aēsop':       'bw-aesop',
};

export function BrandWordmark({ name, className, style }: MarkProps & { name: string }) {
  const treatment = TREATMENTS[name] ?? 'bw-default';
  return (
    <span
      className={['bw', treatment, className].filter(Boolean).join(' ')}
      style={style}
    >
      <AbstractMark seed={name} label="Brand mark — placeholder" />
    </span>
  );
}
