// Platform-wide hotkey help overlay (Phase 20).
//
// Press `?` anywhere to see the registered shortcuts for the current
// page, grouped by intent. Mounts once at the app root via WorkspaceShell;
// every screen registers its own bindings via `registerHotkeyDocs`, and
// they appear here automatically.

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useHotkeys, subscribeHotkeyDocs, type HotkeyDoc } from '@/lib/utils/useHotkeys';

export function HotkeysHelp() {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<HotkeyDoc[]>([]);

  // Subscribe to the doc registry — every page that registers shortcuts
  // shows up here automatically.
  useEffect(() => subscribeHotkeyDocs(setDocs), []);

  // The only hotkey THIS component owns: `?` opens itself.
  // (Always on, even while the modal is open — pressing `?` again closes it.)
  useHotkeys({ '?': () => setOpen((v) => !v) });

  // Group docs by their `group` field so the overlay reads top-down.
  const grouped = groupBy(docs);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      width={560}
    >
      {docs.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-60)', fontSize: 14 }}>
          No shortcuts registered for this page yet.
        </div>
      ) : (
        <div className="hotkeys-help">
          {grouped.map(([group, items]) => (
            <section key={group} className="hotkeys-help-group">
              <div className="hotkeys-help-group-h">{group}</div>
              <dl className="hotkeys-help-list">
                {items.map((d) => (
                  <div className="hotkeys-help-row" key={`${group}-${d.keys}`}>
                    <dt className="hotkeys-help-label">{d.label}</dt>
                    <dd className="hotkeys-help-keys">
                      {d.keys.split(' ').map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="hotkeys-help-then">then</span>}
                          <kbd className="hotkeys-help-kbd">{kbdLabel(k)}</kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className="hotkeys-help-foot">
            Press <kbd className="hotkeys-help-kbd">?</kbd> any time to reopen this list.
          </div>
        </div>
      )}
    </Modal>
  );
}

function groupBy(docs: HotkeyDoc[]): [string, HotkeyDoc[]][] {
  const groups = new Map<string, HotkeyDoc[]>();
  for (const d of docs) {
    const g = d.group || 'General';
    const arr = groups.get(g);
    if (arr) arr.push(d);
    else groups.set(g, [d]);
  }
  // Stable order: Navigation first, Actions second, others alphabetical.
  const order = (g: string) => (g === 'Navigation' ? 0 : g === 'Actions' ? 1 : 2);
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const da = order(a), db = order(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

function kbdLabel(k: string): string {
  // Make a few common keys nicer to read in the overlay.
  if (k === 'ArrowUp') return '↑';
  if (k === 'ArrowDown') return '↓';
  if (k === 'ArrowLeft') return '←';
  if (k === 'ArrowRight') return '→';
  if (k === 'Escape') return 'Esc';
  if (k === 'Space') return '␣';
  if (k === 'Enter') return '⏎';
  return k;
}
