// CinematicPersonaToggle (Phase 34) — fixed top-center, monospace,
// glass-blur. Visually distinct from the Phase-18 `<PersonaToggle>`
// which sits inside the hero — this one is page-global chrome.
//
// Same WAI-ARIA radio-group keyboard semantics (Arrow Left/Right,
// Home/End). Same `usePersona` hook so the choice is shared across
// any other landing components that read persona.

import { useRef } from 'react';
import { usePersona, type Persona } from '@/lib/utils/usePersona';

const ORDER: Persona[] = ['creator', 'brand'];

export function CinematicPersonaToggle() {
  const [persona, setPersona] = usePersona();
  const refs = useRef<Record<Persona, HTMLButtonElement | null>>({ creator: null, brand: null });

  const focusAndSelect = (next: Persona) => {
    setPersona(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: Persona) => {
    const idx = ORDER.indexOf(current);
    let target: Persona | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = ORDER[(idx + 1) % ORDER.length];
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        target = ORDER[(idx - 1 + ORDER.length) % ORDER.length];
        break;
      case 'Home':
        target = ORDER[0];
        break;
      case 'End':
        target = ORDER[ORDER.length - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    if (target) focusAndSelect(target);
  };

  return (
    <div className="cn-persona-toggle" role="radiogroup" aria-label="Are you a creator or a brand?">
      {ORDER.map((opt) => (
        <button
          key={opt}
          ref={(el) => { refs.current[opt] = el; }}
          type="button"
          role="radio"
          aria-checked={persona === opt}
          tabIndex={persona === opt ? 0 : -1}
          className={persona === opt ? 'is-active' : ''}
          onClick={() => setPersona(opt)}
          onKeyDown={(e) => onKeyDown(e, opt)}
        >
          {opt === 'creator' ? 'Creator' : 'Brand'}
        </button>
      ))}
    </div>
  );
}
