// Floating bottom-right checklist that helps a new creator find the next thing to do.
// Auto-dismisses once everything is done. Manually dismissible. Persists dismissal to
// localStorage so we don't nag returning users who chose "later."
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/api/store';
import { useAuth } from '@/lib/auth/useAuth';
import { Icon } from '@/components/ui/Icon';

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

const DISMISS_KEY_PREFIX = 'alamut.onboarding.dismissed.';

export function OnboardingChecklist() {
  const { user, creator } = useAuth();
  const db = useStore((s) => s.db);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Read dismissal flag once on mount per user.
  useEffect(() => {
    if (!user) return;
    setDismissed(localStorage.getItem(DISMISS_KEY_PREFIX + user.id) === '1');
  }, [user]);

  // Only show for creators. Brands have their own onboarding tour already.
  if (!user || !creator || dismissed) return null;

  // Compute progress live from the store. As the creator completes each item,
  // the corresponding row gets a check + line-through.
  const items: ChecklistItem[] = [
    {
      id: 'profile',
      label: 'Set tagline + bio',
      done: !!(creator.tagline && creator.bio),
      href: '/creator/profile?section=identity',
    },
    {
      id: 'platform',
      label: 'Connect a channel',
      done: creator.platforms.length > 0,
      href: '/creator/profile?section=audience',
    },
    {
      id: 'portfolio',
      label: 'Add 3 portfolio pieces',
      done: creator.work.length >= 3,
      href: '/creator/profile?section=portfolio',
    },
    {
      id: 'rates',
      label: 'Set your rates',
      done: (creator.rateCards && creator.rateCards.length > 0) || (creator.rateCard.post !== '' && creator.rateCard.post !== '—'),
      href: '/creator/profile?section=rates',
    },
    {
      id: 'discover',
      label: 'Apply to a campaign',
      done: db.applications.some((a) => a.creatorId === creator.id),
      href: '/creator/discover',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);
  // Auto-dismiss when everything is done — celebrate quietly via the toast/confetti elsewhere.
  if (completed === total) return null;

  const dismiss = () => {
    if (!user) return;
    localStorage.setItem(DISMISS_KEY_PREFIX + user.id, '1');
    setDismissed(true);
  };

  const next = items.find((i) => !i.done);

  return (
    <div
      className="onboarding-checklist"
      role="region"
      aria-label="Get started checklist"
    >
      <button
        className="onboarding-checklist-h"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls="onboarding-checklist-body"
      >
        <div className="onboarding-checklist-progress">
          <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden="true">
            <circle cx={14} cy={14} r={11} fill="none" stroke="var(--rule)" strokeWidth={2.5} />
            <circle
              cx={14} cy={14} r={11}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * (2 * Math.PI * 11)} ${2 * Math.PI * 11}`}
              transform="rotate(-90 14 14)"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.22,.8,.15,1)' }}
            />
            <text x={14} y={17.5} textAnchor="middle" fontSize={9} fontFamily="var(--mono)" fill="var(--ink-80)" fontWeight={500}>
              {completed}/{total}
            </text>
          </svg>
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="mono-meta">Get started</div>
          <div className="onboarding-checklist-next">
            {collapsed ? `Next: ${next?.label || 'all set'}` : 'Set up your profile'}
          </div>
        </div>
        <span className="onboarding-checklist-toggle" aria-hidden="true">
          {collapsed ? '▲' : '▼'}
        </span>
      </button>

      {!collapsed && (
        <>
          <div id="onboarding-checklist-body" className="onboarding-checklist-body">
            {items.map((item) => (
              <button
                key={item.id}
                className={['onboarding-checklist-item', item.done ? 'is-done' : ''].join(' ')}
                onClick={() => !item.done && navigate(item.href)}
                disabled={item.done}
              >
                <span className="onboarding-checklist-bullet">
                  {item.done ? <Icon.check s={11} /> : <span className="onboarding-checklist-empty-bullet" />}
                </span>
                <span className="onboarding-checklist-label">{item.label}</span>
                {!item.done && <Icon.arrow s={11} />}
              </button>
            ))}
          </div>
          <button className="onboarding-checklist-dismiss" onClick={dismiss}>
            Dismiss · I'll explore on my own
          </button>
        </>
      )}
    </div>
  );
}
