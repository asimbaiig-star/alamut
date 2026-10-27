// @vitest-environment jsdom
//
// pages.test.tsx — both landing pages render, link where they say, and
// their builders show the visitor what the other side would see.

import { afterEach, describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { CreatorsPage } from '../CreatorsPage';
import { BrandsPage } from '../BrandsPage';
import { BriefBrowser, BriefBuilder, CreatorBrowser, StorefrontBuilder, StorefrontJoin, useStorefront } from '../tools';
import { DEMO_HREF, PLATFORM_FORMATS, SIGNUP_HREF } from '../facts';
import { CTA_ID } from '../events';
import { BRIEFS, CREATORS } from '../listings';
import { BRIEF_DRAFT_KEY, readBriefDraft, readStorefrontDraft, STOREFRONT_DRAFT_KEY } from '@/lib/landingDraft';

// globals are off, so Testing Library can't register its own cleanup.
afterEach(() => { cleanup(); localStorage.clear(); });

/** The storefront section: the builder and the button that keeps it. */
function Storefront() {
  const sf = useStorefront();
  return <><StorefrontJoin sf={sf} /><StorefrontBuilder sf={sf} /></>;
}
/** Click a link without jsdom trying to navigate. */
function clickLink(el: HTMLElement) {
  el.addEventListener('click', (e) => e.preventDefault(), { once: true });
  fireEvent.click(el);
}

const pages = [
  { name: 'creators', El: CreatorsPage, h1: 'Find brand deals. Run them here.', signup: SIGNUP_HREF.creator, demo: DEMO_HREF.creator },
  { name: 'brands', El: BrandsPage, h1: 'Find creators. Run the deal here.', signup: SIGNUP_HREF.brand, demo: DEMO_HREF.brand },
];

describe.each(pages)('the $name page', ({ El, h1, signup, demo }) => {
  it('prerenders its headline and hero CTAs without a browser', () => {
    // What a visitor sees before any JavaScript runs.
    const html = renderToString(<El />);
    const heading = /<h1 class="lx-h1" id="hero-title">([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(heading.replace(/<[^>]+>/g, '')).toBe(h1);
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
      // Our own pages, or the photographer credit on Unsplash.
      expect(href, a.textContent ?? '').toMatch(/^(\/[a-z0-9/?=&.-]*|https:\/\/unsplash\.com\/photos\/[\w-]+)$/i);
    }
  });

  it('leads with the market, not with escrow', () => {
    // Escrow is the answer to "will I get paid", the third question a
    // visitor asks — not the headline.
    const { container } = render(<El />);
    const hero = container.querySelector('.lx-hero')!;
    expect(hero.textContent).not.toMatch(/escrow/i);
    const sections = [...container.querySelectorAll('main > section')];
    const firstEscrow = sections.findIndex((s) => /escrow/i.test(s.querySelector('h2')?.parentElement?.textContent ?? ''));
    expect(firstEscrow).toBeGreaterThanOrEqual(3);
  });
});

describe('StorefrontBuilder', () => {
  it('turns a typed name into the page a brand would see', () => {
    render(<Storefront />);
    expect(screen.getByText(/Send a brief/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Maya Chen' } });
    expect(screen.getByText(/Brief Maya/)).toBeTruthy();
    expect(screen.getByText('/c/mayachen')).toBeTruthy();
    expect((screen.getByLabelText('Your handle') as HTMLInputElement).value).toBe('mayachen');
  });

  it('stops deriving the handle once the visitor edits it', () => {
    render(<Storefront />);
    fireEvent.change(screen.getByLabelText('Your handle'), { target: { value: 'Maya.Makes' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Someone Else' } });
    expect(screen.getByText('/c/maya.makes')).toBeTruthy();
  });

  it('shows the take-home of each package from the ledger maths', () => {
    render(<Storefront />);
    const reel = screen.getByLabelText('Instagram Reel rate, US dollars').closest('label')!;
    fireEvent.change(screen.getByLabelText('Instagram Reel rate, US dollars'), { target: { value: '1,000' } });
    // 1000 − 10% fee − 5% withholding.
    expect(within(reel).getByText('$850')).toBeTruthy();
  });

  it('sells the packages the real storefront sells', () => {
    render(<Storefront />);
    for (const p of ['Instagram Reel', 'Story bundle (×3)', 'Reel + Stories combo']) {
      expect(screen.getByLabelText(`${p} rate, US dollars`)).toBeTruthy();
    }
  });

  it('keeps what was built only when the visitor joins from it', () => {
    render(<Storefront />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Maya Chen' } });
    fireEvent.change(screen.getByLabelText('Instagram Reel rate, US dollars'), { target: { value: '1,000' } });
    expect(localStorage.getItem(STOREFRONT_DRAFT_KEY), 'typing alone stores nothing').toBeNull();
    const join = screen.getByRole('link', { name: 'Join free' });
    expect(join.getAttribute('href')).toBe(SIGNUP_HREF.creator);
    clickLink(join);
    expect(readStorefrontDraft(localStorage)).toMatchObject({ name: 'Maya Chen', handle: 'mayachen', niche: 'Beauty', rates: { reel: 1000 } });
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

  it('keeps the brief for the campaign wizard when the brand posts it', () => {
    render(<BriefBuilder />);
    fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Spring drop' } });
    expect(localStorage.getItem(BRIEF_DRAFT_KEY)).toBeNull();
    const post = screen.getByRole('link', { name: 'Post this brief' });
    expect(post.getAttribute('href')).toBe(SIGNUP_HREF.brand);
    clickLink(post);
    expect(readBriefDraft(localStorage)).toMatchObject({ title: 'Spring drop', platform: 'instagram', format: 'reel', count: 2, perCreator: 1500 });
  });
});

describe('the first screens', () => {
  const picks = () => [...document.querySelectorAll('.lx-pick-title')].map((t) => t.textContent);

  it('filter briefs by category in place', () => {
    render(<BriefBrowser />);
    fireEvent.click(screen.getByRole('button', { name: 'Food' }));
    expect(picks()).toEqual(BRIEFS.filter((b) => b.category === 'Food').slice(0, 4).map((b) => b.title));
    expect(screen.getByRole('button', { name: 'Food' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('open the picked brief and price a pitch from the ledger maths', () => {
    render(<BriefBrowser />);
    const second = BRIEFS[1]!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second.title) }));
    const card = screen.getByRole('article', { name: `Example brief: ${second.title}` });
    fireEvent.change(within(card).getByLabelText(/^Your rate for the deal/), { target: { value: '1,000' } });
    // 1000 − 10% fee − 5% withholding.
    expect(within(card).getByText('$850')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Join free to pitch' }).getAttribute('href')).toBe(SIGNUP_HREF.creator);
  });

  it('filter creators by platform in place', () => {
    render(<CreatorBrowser />);
    fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));
    expect(picks()).toEqual(CREATORS.filter((c) => c.channels.some((ch) => ch.platform === 'YouTube')).slice(0, 4).map((c) => c.niche));
  });

  it('price the package a brand picks, with the fee where the code puts it', () => {
    render(<CreatorBrowser />);
    const c = CREATORS[0]!;
    const card = screen.getByRole('article', { name: `Example storefront: ${c.niche}` });
    const story = c.packages.find((p) => p.key === 'story')!;
    fireEvent.click(within(card).getByLabelText(/Story bundle/));
    expect(card.querySelector('.lx-act-keep')!.textContent).toMatch(new RegExp(`^You pay \\$${story.rate}, with no fee on top`));
  });

  it('say they are examples', () => {
    render(<BriefBrowser />);
    expect(screen.getByText(/^Example briefs, drawn as Browse campaigns shows them\./)).toBeTruthy();
    expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
    cleanup();
    render(<CreatorBrowser />);
    expect(screen.getByText(/^Example storefronts, drawn as Discover shows them\./)).toBeTruthy();
  });
});
