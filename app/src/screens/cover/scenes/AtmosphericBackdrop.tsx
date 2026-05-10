// AtmosphericBackdrop (Phase 34) — page-global lighting layer.
//
// Renders the two radial-gradient light sources + the film-grain
// overlay that establish the cinematic atmosphere. Sits BEHIND every
// scene's content (z-index 0 + 1) and tracks the persona palette via
// the `[data-persona]` attribute on the cinematic root.
//
// Both gradients live in CSS (cinematic.css) — this component is just
// the DOM mount point. Keeping the gradients in CSS means the persona
// transition uses CSS's own easing engine (smoother than animating
// inline-style on every paint).

export function AtmosphericBackdrop() {
  return (
    <>
      <div className="cn-backdrop" aria-hidden="true" />
      <div className="cn-grain" aria-hidden="true" />
    </>
  );
}
