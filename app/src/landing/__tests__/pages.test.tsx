// @vitest-environment jsdom
//
// pages.test.tsx — both landing pages render, link where they say, and
// their builders show the visitor what the other side would see.

import { afterEach, describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { CreatorsPage } from '../CreatorsPage';
import { BrandsPage } from '../BrandsPage';
import { BriefBuilder, StorefrontBuilder } from '../tools';
import { DEMO_HREF, PLATFORM_FORMATS, SIGNUP_HREF } from '../facts';
import { CTA_ID } from '../events';

// globals are off, so Testing Library can't register its own cleanup.
afterEach(cleanup);

const pages = [
  { name: 'creators', El: CreatorsPage, h1: 'Get booked by brands — at your rates.', signup: SIGNUP_HREF.creator, demo: DEMO_HREF.creator },
  { name: 'brands', El: BrandsPage, h1: 'Post a brief. Get pitches from creators who want it.', signup: SIGNUP_HREF.brand, demo: DEMO_HREF.brand },
];

describe.each(pages)('the $name page', ({ El, h1, signup, demo }) => {
  it('prerenders its headline and hero CTAs without a browser', () => {
    // What a visitor sees before any JavaScript runs.
    const html = renderToString(<El />);
    expect(html).toContain(`<h1 class="lx-h1" id="hero-title">${h1}</h1>`);
    expect(html).toContain(`href="${signup}" data-cta="hero-`);
    expect(html).toContain(`href="${demo}"`);
  });

  it('labels every CTA once, so a click can be attributed to one place', () => {
    const { container } = render(<El />);
    const ids = [...container.querySelectorAll('[data-cta]')].map((a) => a.getAttribute('data-cta'));
    expect(ids.length).toBeGreaterThan(6);
    expect(new Set(ids).size).toBe(ids.length);
    // …in the only shape landing_events accepts, or the click is refused.
    for (const id of ids) expect(id).toMatch(CTA_ID);
  });

  it('has no dead links', () => {
    const { container } = render(<El />);
    for (const a of container.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? '';
      expect(href, a.textContent ?? '').toMatch(/^\/[a-z0-9/?=&.-]*$/i);
    }
  });

  it('leads with the market, not with escrow', () => {
    // Escrow is the answer to "will I get paid", the third question a
    // visitor asks — not the headline.
    const { container } = render(<El />);
    const hero = container.querySelector('.lx-hero-copy')!;
    expect(hero.textContent).not.toMatch(/escrow/i);
    const sections = [...container.querySelectorAll('main > section')];
    const firstEscrow = sections.findIndex((s) => /escrow/i.test(s.querySelector('h2')?.parentElement?.textContent ?? ''));
    expect(firstEscrow).toBeGreaterThanOrEqual(3);
  });
});

describe('StorefrontBuilder', () => {
  it('turns a typed name into the page a brand would see', () => {
    render(<StorefrontBuilder />);
    expect(screen.getByText(/Send a brief/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Maya Chen' } });
    expect(screen.getByText(/Brief Maya/)).toBeTruthy();
    expect(screen.getByText('/c/mayachen')).toBeTruthy();
    expect((screen.getByLabelText('Your handle') as HTMLInputElement).value).toBe('mayachen');
  });

  it('stops deriving the handle once the visitor edits it', () => {
    render(<StorefrontBuilder />);
    fireEvent.change(screen.getByLabelText('Your handle'), { target: { value: 'Maya.Makes' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Someone Else' } });
    expect(screen.getByText('/c/maya.makes')).toBeTruthy();
  });

  it('shows the take-home of each package from the ledger maths', () => {
    render(<StorefrontBuilder />);
    const reel = screen.getByLabelText('Reel rate, US dollars').closest('label')!;
    fireEvent.change(screen.getByLabelText('Reel rate, US dollars'), { target: { value: '1,000' } });
    // 1000 − 10% fee − 5% withholding.
    expect(within(reel).getByText('$850')).toBeTruthy();
  });
});

describe('BriefBuilder', () => {
  it('offers each platform’s own formats, and resets the format on switch', () => {
    render(<BriefBuilder />);
    const platform = screen.getByLabelText('Platform') as HTMLSelectElement;
    const format = () => screen.getByLabelText('Format') as HTMLSelectElement;
    expect([...platform.options].map((o) => o.value)).toEqual(PLATFORM_FORMATS.map((p) => p.value));
    fireEvent.change(platform, { target: { value: 'youtube' } });
    const yt = PLATFORM_FORMATS.find((p) => p.value === 'youtube')!;
    expect([...format().options].map((o) => o.value)).toEqual(yt.formats.map((f) => f.value));
    expect(format().value).toBe(yt.formats[0]!.value);
    expect(screen.getByText(`2 × YouTube ${yt.formats[0]!.label}`)).toBeTruthy();
  });
});
