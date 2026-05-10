// Shared chromatic hues for admin queue tiles (Phase 20 cleanup).
//
// Previously duplicated as a private `QUEUE_HUE` map in admin/Home.tsx.
// Now lives in one place so future admin-queue palette tweaks propagate.
//
// NOTE: OnboardingTour uses a different per-step narrative palette
// (welcome / discover / lifecycle / wallet / brief / etc.) — not queue
// semantics — so it intentionally does NOT consume this module.

export const QUEUE_HUE: Record<string, string> = {
  creators: 'oklch(0.55 0.13 145)',  // sage — calm "people" queue
  brands:   'oklch(0.55 0.12 220)',  // blue — corporate / trust
  disputes: 'oklch(0.55 0.18 25)',   // red — needs human eyes
  escrow:   'oklch(0.60 0.16 60)',   // gold — money in flight
  payouts:  'oklch(0.55 0.14 290)',  // plum — outflow
};
