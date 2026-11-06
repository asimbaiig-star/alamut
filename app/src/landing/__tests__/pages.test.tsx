// @vitest-environment jsdom
//
// pages.test.tsx — both landing pages render, link where they say, and
// their builders show the visitor what the other side would see.

import { afterEach, describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { CreatorsPage } from '../CreatorsPage';
import { BrandsPage } from '../BrandsPage';
import { BriefBrowser, PayoutTool, RateHelper, STOREFRONT_START, StorefrontBuilder, StorefrontJoin, useStorefront } from '../tools-creators';
import { BriefBuilder, CreatorBrowser, HoldTool } from '../tools-brands';
import { usd } from '../estimate';
import { startingRates, suggestRateBand } from '@/screens/tools/rateGuidance';
import { brandAccent, DEMO_HREF, PLATFORM_FORMATS, SIGNUP_HREF } from '../facts';
import { CTA_ID } from '../events';
import { BRIEFS } from '../listings-briefs';
import { CREATORS } from '../listings-creators';
import { BRAND_MARKET, CREATOR_MARKET, MARKET_SOURCE_LINE } from '../market';
import { BRIEF_DRAFT_KEY, readBriefDraft, readStorefrontDraft, STOREFRONT_DRAFT_KEY } from '@/lib/landingDraft';

// globals are off, so Testing Library can't register its own cleanup.
afterEach(() => { cleanup(); localStorage.clear(); });

/** The storefront section: the rate helper, the builder and the button that keeps it. */
function Storefront() {
  const sf = useStorefront();
  return <><RateHelper sf={sf} /><StorefrontJoin sf={sf} /><StorefrontBuilder sf={sf} /></>;
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
    expect(screen.getByText(/\/c\/mayachen$/)).toBeTruthy();
    expect((screen.getByLabelText('Your handle') as HTMLInputElement).value).toBe('mayachen');
  });

  it('stops deriving the handle once the visitor edits it', () => {
    render(<Storefront />);
    fireEvent.change(screen.getByLabelText('Your handle'), { target: { value: 'Maya.Makes' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Someone Else' } });
    expect(screen.getByText(/\/c\/maya\.makes$/)).toBeTruthy();
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
  it('lay a pile of briefs, each with its rate, and open the first', () => {
    render(<BriefBrowser />);
    expect(screen.getByRole('article', { name: `Example brief: ${BRIEFS[0]!.title}` })).toBeTruthy();
    const pile = screen.getByRole('list', { name: 'Example open briefs' });
    expect(within(pile).getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    expect(within(pile).getByRole('button', { name: new RegExp(BRIEFS[1]!.title) }).textContent).toContain(usd(BRIEFS[1]!.perCreator));
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

  it('put the sheet that was open back on the pile, and start the next pitch fresh', () => {
    render(<BriefBrowser />);
    const [first, second] = BRIEFS;
    fireEvent.change(screen.getByLabelText(/^Your rate for the deal/), { target: { value: '9,000' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second!.title) }));
    expect(screen.getByRole('button', { name: new RegExp(first!.title) })).toBeTruthy();
    expect((screen.getByLabelText(/^Your rate for the deal/) as HTMLInputElement).value).toBe(second!.perCreator.toLocaleString('en-US'));
  });

  it('move focus to the sheet, because the band that was clicked is gone', () => {
    render(<BriefBrowser />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(BRIEFS[1]!.title) }));
    expect(document.activeElement?.classList.contains('lx-slot')).toBe(true);
  });

  it('flood the page with the picked brand’s own letterhead', () => {
    render(<main><BriefBrowser /></main>);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(BRIEFS[1]!.title) }));
    expect(document.querySelector('main')!.style.getPropertyValue('--ground')).toBe(brandAccent(BRIEFS[1]!.brand).bg);
  });

  it('price the package a brand picks, with the fee where the code puts it', () => {
    render(<CreatorBrowser />);
    const c = CREATORS[0]!;
    const card = screen.getByRole('article', { name: `Example storefront: ${c.niche}` });
    const story = c.packages.find((p) => p.key === 'story')!;
    fireEvent.click(within(card).getByLabelText(/Story bundle/));
    expect(card.querySelector('.lx-act-figure .lx-money')!.textContent).toBe(usd(story.rate));
    expect(card.querySelector('.lx-act-keep')!.textContent).toMatch(/^No fee on top\. The .+ platform fee comes out of the creator’s payout\.$/);
  });

  it('say they are examples', () => {
    // Named above the pile, at eye level, not in a note under it.
    render(<BriefBrowser />);
    expect(screen.getByText('Examples. Pick one.')).toBeTruthy();
    expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
    cleanup();
    render(<CreatorBrowser />);
    expect(screen.getByText('Examples. Pick one.')).toBeTruthy();
    expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
  });
});

describe('the money tools', () => {
  it('hold a figure that reads as plain text, whatever the odometer is doing', () => {
    render(<PayoutTool lead="Lead" />);
    // 1800 − 10% fee − 5% withholding.
    expect(screen.getByText('$1,530')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Your rate for the deal/), { target: { value: '1,000' } });
    expect(screen.getByText('$850')).toBeTruthy();
  });

  it('release a post when it’s marked live, and take it back', () => {
    render(<PayoutTool lead="Lead" />);
    const posts = screen.getAllByRole('button', { pressed: false }).filter((b) => /Post/.test(b.textContent ?? ''));
    expect(screen.getByText('Released so far').nextElementSibling!.textContent).toBe('$900');
    fireEvent.click(posts[0]!);
    expect(screen.getByText('Released so far').nextElementSibling!.textContent).toBe('$1,800');
    fireEvent.click(screen.getByRole('button', { name: /Post 2/ }));
    expect(screen.getByText('Released so far').nextElementSibling!.textContent).toBe('$900');
  });

  it('never show more posts released than the deal has', () => {
    render(<PayoutTool lead="Lead" />);
    fireEvent.click(screen.getByRole('button', { name: /Post 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fewer posts' }));
    expect(screen.getByText('Released so far').nextElementSibling!.textContent).toBe('$1,800');
    expect(screen.getByRole('button', { name: /^Post/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('release what a whole round of posts holds across a brief', () => {
    render(<HoldTool lead="Lead" />);
    // 3 creators at $1,500, 2 posts each: a round is half of $4,500.
    expect(screen.getByText('$4,500', { selector: '.lx-sr' })).toBeTruthy();
    expect(screen.getByText('Released so far').nextElementSibling!.textContent).toBe('$2,250');
  });
});

describe('what to charge', () => {
  it('prices all three packages from the band onboarding uses, when asked', () => {
    render(<Storefront />);
    fireEvent.change(screen.getByLabelText(/^Instagram followers/), { target: { value: '80,000' } });
    fireEvent.change(screen.getByLabelText(/^Engagement rate/), { target: { value: '3.5' } });
    expect((screen.getByLabelText(/^Engagement rate/) as HTMLInputElement).value, 'a decimal survives typing').toBe('3.5');
    const band = suggestRateBand('instagram', 80_000, 3.5)!;
    const start = startingRates(band);
    expect(screen.getByText(`${usd(band.low)}–${usd(band.high)}`)).toBeTruthy();
    // Nothing changes until the visitor takes the suggestion.
    expect((screen.getByLabelText('Instagram Reel rate, US dollars') as HTMLInputElement).value).toBe(STOREFRONT_START.reel.toLocaleString('en-US'));
    expect(screen.getByText(new RegExp(`Reel ${usd(start.reel).replace('$', '\\$')}, Story bundle`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use these prices' }));
    expect((screen.getByLabelText('Instagram Reel rate, US dollars') as HTMLInputElement).value).toBe(start.reel.toLocaleString('en-US'));
    expect((screen.getByLabelText('Story bundle (×3) rate, US dollars') as HTMLInputElement).value).toBe(start.story.toLocaleString('en-US'));
    expect((screen.getByLabelText('Reel + Stories combo rate, US dollars') as HTMLInputElement).value).toBe(start.combo.toLocaleString('en-US'));
  });

  it('shows no band without a follower count, rather than a zero', () => {
    render(<Storefront />);
    fireEvent.change(screen.getByLabelText(/^Instagram followers/), { target: { value: '' } });
    expect(screen.getByText('Add your follower count to see a typical range.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use these prices' })).toBeNull();
  });
});

describe.each(pages)('the $name page’s deal story', ({ El }) => {
  it('reads as a plain list, each line saying where it’s from', () => {
    const { container } = render(<El />);
    const steps = [...container.querySelectorAll('.lx-steps > li')];
    expect(steps.length).toBeGreaterThan(3);
    for (const s of steps) {
      expect(s.querySelector('.lx-was-from')!.textContent).toBeTruthy();
      expect(s.querySelector('.lx-now')!.textContent).toMatch(/^On Alamut: /);
    }
  });

  it('has a row of the workspace for every step of the story', () => {
    const { container } = render(<El />);
    expect(container.querySelectorAll('.lx-step-row').length).toBe(container.querySelectorAll('.lx-steps > li').length);
  });

  it('shows everything at rest until the browser says it can move', () => {
    // jsdom has no matchMedia, like a page before this code has run.
    const { container } = render(<El />);
    expect(container.querySelector('.is-live')).toBeNull();
    expect(container.querySelector('[data-state]')).toBeNull();
  });
});

describe.each([
  { name: 'creators', El: CreatorsPage, figures: CREATOR_MARKET },
  { name: 'brands', El: BrandsPage, figures: BRAND_MARKET },
])('the $name page’s market figures', ({ El, figures }) => {
  it('sit right under the hero, each with the line saying whose they are', () => {
    const { container } = render(<El />);
    const sections = [...container.querySelectorAll('main > section')];
    const strip = sections[1]!;
    expect(strip.classList.contains('lx-market')).toBe(true);
    expect(within(strip as HTMLElement).getByText(MARKET_SOURCE_LINE)).toBeTruthy();
    expect([...strip.querySelectorAll('.lx-market-figure')].map((n) => n.textContent)).toEqual(figures.map((f) => f.figure));
  });
});

describe('the storefront and the rate helper', () => {
  it('agree when the page loads', () => {
    render(<Storefront />);
    const band = screen.getByText(/^\$[\d,]+–\$[\d,]+$/).textContent!;
    const [low, high] = band.split('–').map((x) => Number(x.replace(/[^\d]/g, '')));
    const reel = Number((screen.getByLabelText('Instagram Reel rate, US dollars') as HTMLInputElement).value.replace(/[^\d]/g, ''));
    expect(reel).toBeGreaterThanOrEqual(low!);
    expect(reel).toBeLessThanOrEqual(high!);
  });
});

describe('the founder’s note', () => {
  it('stays off both pages while it’s a draft', async () => {
    const { FOUNDER } = await import('../founder');
    if (FOUNDER.ready) return;
    for (const El of [CreatorsPage, BrandsPage]) {
      const { container } = render(<El />);
      expect(container.querySelector('.lx-founder')).toBeNull();
      cleanup();
    }
  });
});

