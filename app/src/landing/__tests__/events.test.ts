// events.test.ts — what the landing may send, and when it must not.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CTA_ID, eventsEnabled, newVisitId, referrerHost, viewportOf } from '../events';

const on = { dev: false, host: 'alamut-six.vercel.app', url: 'https://x.supabase.co', key: 'sb_publishable_x' };

describe('eventsEnabled', () => {
  it('sends from the deployed site', () => {
    expect(eventsEnabled(on)).toBe(true);
  });

  it('never from a dev build or a local host', () => {
    expect(eventsEnabled({ ...on, dev: true })).toBe(false);
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'alamut.localhost', 'mac.local', 'app.test']) {
      expect(eventsEnabled({ ...on, host }), host).toBe(false);
    }
  });

  it('never without Supabase configured', () => {
    expect(eventsEnabled({ ...on, url: '' })).toBe(false);
    expect(eventsEnabled({ ...on, key: undefined })).toBe(false);
  });

  it('never when the visitor asked not to be tracked', () => {
    expect(eventsEnabled({ ...on, dnt: '1' })).toBe(false);
    expect(eventsEnabled({ ...on, gpc: true })).toBe(false);
  });
});

describe('what a row may contain', () => {
  it('a referrer is reduced to its host, and our own host is not one', () => {
    expect(referrerHost('https://www.google.com/search?q=me@example.com', 'alamut-six.vercel.app')).toBe('www.google.com');
    expect(referrerHost('https://alamut-six.vercel.app/for-brands', 'alamut-six.vercel.app')).toBeNull();
    expect(referrerHost('', 'alamut-six.vercel.app')).toBeNull();
    expect(referrerHost('not a url', 'alamut-six.vercel.app')).toBeNull();
  });

  it('a visit id is random and fits the table’s check', () => {
    const a = newVisitId(); const b = newVisitId();
    expect(a).toMatch(/^[a-z0-9]{12,32}$/);
    expect(a).not.toBe(b);
  });

  it('viewport buckets match the CSS breakpoints', () => {
    expect([viewportOf(375), viewportOf(768), viewportOf(1023), viewportOf(1024)])
      .toEqual(['mobile', 'tablet', 'tablet', 'desktop']);
  });

  it('the client and the table agree on every shape', () => {
    // A mismatch means every event is silently refused by a CHECK.
    const sql = readFileSync(join(__dirname, '..', '..', '..', 'supabase/migrations/040_landing_events.sql'), 'utf8');
    expect(sql).toContain(`cta ~ '${CTA_ID.source}'`);
    expect(sql).toContain("visit ~ '^[a-z0-9]{12,32}$'");
    expect(sql).toContain("event in ('landing_view', 'cta_click')");
    expect(sql).toContain("page in ('creators', 'brands')");
    expect(sql).toContain("viewport in ('mobile', 'tablet', 'desktop')");
    expect(sql).toMatch(/grant insert \(page, event, cta, visit, viewport, referrer_host\)/);
  });

  it('never stores the session or anything else in the browser', () => {
    const src = readFileSync(join(__dirname, '..', 'events.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    expect(src).not.toMatch(/Authorization/);
  });
});
