// Keyboard shortcut hook (Phase 20).
//
// Powers the platform-wide hotkey system. The brand persona expects
// Linear/Notion-style speed (`g t` for Today, `j/k` for row nav, `a/r`
// for approve/reject, `?` for help), and admin moderation literally
// can't scale without it. This hook is the single primitive every screen
// uses.
//
// Design choices:
//   - Bindings are passed as a flat map: `{ 'a': fn, 'g t': fn, '?': fn }`.
//     Two-key sequences ("leader" style — `g t`, `g i`, `g c`) are
//     supported with a 1-second window between key presses.
//   - We DON'T fire when the user is typing in an input/textarea/contenteditable
//     unless the binding explicitly opts in (`{ key: 'a', allowInInputs: true }`).
//   - All bindings are registered globally — there's no per-element scope
//     because hotkey users expect them to work from anywhere on the page.
//   - `Esc`, `Enter`, modifier-key shortcuts (`Cmd+K`) are handled by
//     callers directly (Modal already binds Esc, GlobalSearch binds Cmd+K);
//     this hook is for plain letter / digit / `?` / `/` shortcuts.
//
// Usage:
//   useHotkeys({
//     'g t': () => navigate('/brand/today'),
//     'g c': () => navigate('/brand/campaigns'),
//     'a':   () => approveSelected(),
//     'r':   () => requestRevisions(),
//     '?':   () => setHelpOpen(true),
//   });
//
//   // Opt-in to fire while focused in inputs:
//   useHotkeys({ 'Escape': closeFocus }, { allowInInputs: true });

import { useEffect, useRef } from 'react';

type Handler = (e: KeyboardEvent) => void;
export type HotkeyMap = Record<string, Handler>;

interface Options {
  /** Fire bindings even while focused in <input>/<textarea>/contenteditable. */
  allowInInputs?: boolean;
  /** Disable all bindings without unmounting. */
  disabled?: boolean;
  /** Window in ms between leader key and follow-up. Default 1000. */
  sequenceWindowMs?: number;
}

const SEQUENCE_DEFAULT_MS = 1000;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Normalize a KeyboardEvent into a single-key descriptor like 'a' / '?' / 'Escape'. */
function keyDescriptor(e: KeyboardEvent): string {
  // Treat space as 'Space' so a binding can target it explicitly.
  if (e.key === ' ') return 'Space';
  // Single printable chars: lowercase the letter (so capslock doesn't matter)
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}

export function useHotkeys(map: HotkeyMap, options: Options = {}): void {
  const { allowInInputs = false, disabled = false, sequenceWindowMs = SEQUENCE_DEFAULT_MS } = options;

  // Use a ref so the listener stays stable across renders even as `map`
  // identity changes (caller can pass a fresh object literal each time).
  const mapRef = useRef(map);
  mapRef.current = map;

  // Phase 20 QA fix: the leader-sequence state is now module-level (see
  // `globalLeader` at bottom of file) so all useHotkeys instances coordinate.

  useEffect(() => {
    if (disabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore key events inside inputs unless explicitly allowed.
      if (!allowInInputs && isTypingTarget(e.target)) return;

      // Modifier keys are reserved for native shortcuts (Cmd+K, Cmd+S, etc.).
      // Hotkeys here are plain-letter; let the OS handle anything with mods.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Phase 20 QA fix: suspend page-level hotkeys while any modal is open.
      // Without this, pressing `a` inside the Approvals page's "Request
      // revisions" modal — or even inside the help overlay — would fire
      // the page's approve handler. `?` is special-cased so it can always
      // toggle the help overlay even from within other modals.
      const key = keyDescriptor(e);
      if (key !== '?' && hasOpenModal()) return;

      const m = mapRef.current;
      const now = Date.now();

      // Phase 20 QA fix: leader state is shared across ALL useHotkeys
      // instances on the page (module-level `globalLeader`). Without this,
      // the GlobalHotkeys listener would consume `g a` for navigation but
      // the Approvals listener would ALSO fire its `a` handler immediately
      // afterward — silently approving a submission while the user thought
      // they were just navigating.
      const leader = globalLeader;
      if (leader && leader.expires > now) {
        const seq = `${leader.key} ${key}`;
        const handler = m[seq];
        if (handler) {
          globalLeader = null;            // sequence consumed
          e.preventDefault();
          e.stopImmediatePropagation();   // suppress later listeners on window
          handler(e);
          return;
        }
        // Sequence didn't match in this hook's map — but another hook may
        // have it. Don't clear the leader; let other listeners try.
      } else if (leader) {
        globalLeader = null; // expired
      }

      // Single-key binding?
      const direct = m[key];
      if (direct) {
        e.preventDefault();
        e.stopImmediatePropagation();
        direct(e);
        return;
      }

      // Could this key be the start of a multi-key sequence in our map?
      // Set the global leader so subsequent hooks can race for the follow-up.
      const isLeader = Object.keys(m).some((b) => b.startsWith(`${key} `));
      if (isLeader && !globalLeader) {
        globalLeader = { key, expires: now + sequenceWindowMs };
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowInInputs, disabled, sequenceWindowMs]);
}

// ============================================================
// Module-level leader state — shared across all useHotkeys instances so
// `g X` sequences in GlobalHotkeys and single-key handlers on pages don't
// double-fire. See the comment inside onKeyDown for rationale.
// ============================================================
let globalLeader: { key: string; expires: number } | null = null;

function hasOpenModal(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

// ============================================================
// Help registry — every page registers its bindings so the `?` overlay
// can show contextually-relevant shortcuts.
// ============================================================

export interface HotkeyDoc {
  keys: string;       // e.g. 'g t' or '?' — exactly as bound
  label: string;      // human description
  /** Optional grouping for the help overlay ('Navigation', 'Approvals', etc.). */
  group?: string;
}

const docs = new Set<HotkeyDoc>();
const docSubscribers = new Set<(d: HotkeyDoc[]) => void>();

function notify() {
  const list = Array.from(docs);
  docSubscribers.forEach((s) => s(list));
}

/** Register a set of hotkey docs. Returns an unregister fn (for useEffect). */
export function registerHotkeyDocs(...entries: HotkeyDoc[]): () => void {
  entries.forEach((e) => docs.add(e));
  notify();
  return () => {
    entries.forEach((e) => docs.delete(e));
    notify();
  };
}

/** Subscribe to the doc registry from a React component. */
export function subscribeHotkeyDocs(cb: (docs: HotkeyDoc[]) => void): () => void {
  docSubscribers.add(cb);
  cb(Array.from(docs));
  return () => { docSubscribers.delete(cb); };
}
