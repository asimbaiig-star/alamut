# Alamut · Cinematic Landing — Phase 33 Visual Prototypes

Two single-file HTML prototypes that establish the visual bar for the
**Direction B (cinematic scroll narrative)** rebuild of the landing
page. These are not the production code — they're the design we'll
match in React.

## Files

- **`01-hero-offer-arrives.html`** — Act I. The hero scene. Notification
  arrives. Persona toggle morphs ember↔cobalt palette. Drifting motes
  in canvas. Massive Fraunces serif headline emerging from darkness.
- **`02-act-money-flow.html`** — Act II + Act IV preview. Scroll-driven
  money particles flowing brand → escrow → creator. Three live balance
  numbers that update with scroll position. Fill-ring around escrow
  shows current state.

## How to view

Open either file in any modern browser. Both are self-contained — no
build step, no server required. They use Google Fonts (Fraunces, Inter,
JetBrains Mono) so an internet connection helps.

```
file:///.../landing-prototype/01-hero-offer-arrives.html
file:///.../landing-prototype/02-act-money-flow.html
```

## What to evaluate

For each prototype, look for:

1. **Atmospheric depth.** Does the scene have real shadows + glows? Or
   does it still feel like a tasteful AI gradient?
2. **Typographic confidence.** Fraunces at 168px italic — too much?
   Just right? Should we go bigger?
3. **Motion intentionality.** Do the particles read as meaningful (air,
   then money) — or do they read as decoration?
4. **Persona morph.** Does the ember↔cobalt palette switch carry the
   "two-sided marketplace" idea? Or does it feel arbitrary?
5. **Anti-AI-slop.** Is there a single moment that distinctly *isn't*
   what a generic AI design tool would output?

## What to interact with

- **Click the persona toggle** at the top center (or press `c` / `b`)
- **Scroll** the Act II prototype — the choreography is scroll-driven
- **Resize the window** — both files reflow
- **Try `prefers-reduced-motion`** — both honor it (motion stops, static
  composition shows)

## Known gaps in the prototypes (intentional)

- No real photography (production will have it; here pure type +
  atmospherics)
- Act II only shows one act; the React build choreographs all 5
- No mobile-redesign yet (production has Phase 39 dedicated to that)
- No copy A/B variants (just one persona-pair locked in)

## Next phase

Once the visual direction lands, Phase 34 starts the React rebuild:
build a `<CinematicScene>` primitive, wire `useScroll` into it, port
the look from these prototypes into the production codebase under
`app/src/screens/cover/Cover.tsx`.
