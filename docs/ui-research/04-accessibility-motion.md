# Meal Picker — UI Redesign Research

## Dimension 04: Accessibility, Motion/Microinteractions, and Responsive Behavior

_Senior product design research for an enterprise-grade redesign. Date: 2026-06-26._

This document audits the **current** `src/App.jsx` / `src/App.css` implementation against
2025 best practices (WCAG 2.2, Material 3 motion, Apple HIG, IBM Carbon) and gives concrete,
copy-pasteable recommendations. Every recommendation is tied to a specific element in the app.

---

## 0. Executive summary

The current app is functionally fine but reads as a weekend project, not an enterprise product.
The three biggest credibility gaps are:

1. **Accessibility is largely absent.** No focus-visible styling, no ARIA on the two collapsible
   panels, the dynamic winner is never announced to screen readers, the `×` remove buttons have no
   accessible name, hit targets are below the 24px AA floor, and several text colors fail contrast.
2. **Motion is uncalibrated.** Durations are arbitrary (`0.15s`, `0.3s`, `0.25s`), there is no
   consistent easing system, hover uses raw `opacity` (the amateur tell), and there is **zero**
   `prefers-reduced-motion` handling — the 1.2s strobing spinner is an actual accessibility/seizure risk.
3. **It is not responsive.** A hard-coded `width: 460px` card overflows small phones and has no
   breakpoints, no safe-area handling, and no fluid sizing.

Fixing these is what separates "amateur" from "professional."

---

## 1. Accessibility (WCAG 2.2 AA target)

### 1.1 The `×` remove buttons have no accessible name — **blocker**

`App.jsx:151` renders `<button className="remove-btn" onClick={...}>×</button>`. The `×` character
is U+00D7; many screen readers announce it as "times" or nothing useful, and the button gives no
indication of *what* it removes. This fails **WCAG 2.4.4 / 2.5.3 (Name, Role, Value)**.

```jsx
<button
  className="remove-btn"
  aria-label={`Remove ${name}`}
  onClick={() => removeRestaurant(key)}
>
  <span aria-hidden="true">×</span>
</button>
```

Always interpolate the restaurant name so the label is unique per row ("Remove Chipotle"), not a
generic "Remove" repeated N times.

### 1.2 Collapsible panels need disclosure ARIA

Both the suggestions panel (`help-toggle` → `help-panel`, `App.jsx:107-124`) and the Share section
(`btn-share` → `share-box`, `App.jsx:164-168`) are **disclosure** widgets but expose no state. A
screen-reader user cannot tell they are toggles or whether they are open.

Apply the standard disclosure pattern (WAI-ARIA Authoring Practices):

```jsx
<button
  className="help-toggle"
  aria-expanded={helpOpen}
  aria-controls="help-panel"
  onClick={() => setHelpOpen(o => !o)}
>
  Need help? Browse options
</button>
<div id="help-panel" className={`help-panel ${helpOpen ? 'open' : ''}`} hidden={!helpOpen}>
  …
</div>
```

Notes:
- `aria-expanded` is the load-bearing attribute; `aria-controls` is nice-to-have (support is uneven
  but harmless).
- Use the `hidden` attribute (or `inert`) when collapsed so the chips/links inside are **removed
  from the tab order**. Right now, even when the panel is visually collapsed (`max-height: 0`), every
  suggestion chip is still focusable — a keyboard user tabs into invisible controls. This is a common
  and disqualifying bug. (If you animate height you must toggle `hidden`/`inert` *after* the collapse
  transition, or just accept the snap — see §2.3.)
- Do the identical treatment for the Share toggle.

### 1.3 Announce the winner with a live region — **the single highest-impact a11y fix**

The whole point of the app is the result, and it is currently **silent** to assistive tech. The
winner text (`App.jsx:158-160`) and the spinning highlight are pure visual state.

Add a polite live region that announces the outcome. Use `aria-live="polite"` (not `assertive`) —
the result is important but not an emergency, and polite waits for the user to finish their current
action before speaking:

```jsx
<div className="result" role="status" aria-live="polite">
  {winner && !spinning ? `Let's go to ${winner}!` : ''}
</div>
```

Key details:
- The live region element must be **present in the DOM before** the text changes, so the screen
  reader is "listening." Render the container always; swap only its text content. (The current
  conditional `{winner && !spinning && <div…>}` mounts the node at the same moment the text appears,
  which many screen readers miss.)
- `role="status"` implies `aria-live="polite"` and `aria-atomic="true"`; either approach works.
- Do **not** announce every spin frame. The 80ms `spinIndex` flicker would fire dozens of
  announcements. Only the final winner should be in the live region.
- Consider also announcing "Picking…" at spin start in the same region for parity with sighted users
  who see the animation.

### 1.4 Focus management & keyboard navigation

- **Add a global `:focus-visible` style.** The CSS sets `outline: none` on the text input
  (`App.css:79`) and never restores a focus indicator anywhere. Keyboard users are flying blind. This
  fails **WCAG 2.4.7 (Focus Visible)** and brushes **2.4.11 (Focus Appearance, new in 2.2)**.

  ```css
  :focus-visible {
    outline: 2px solid #ff6b35;
    outline-offset: 2px;
    border-radius: 6px;
  }
  /* keep mouse users clean */
  :focus:not(:focus-visible) { outline: none; }
  ```

  WCAG 2.2 SC 2.4.11 wants a focus indicator that is at least as large as a 2px-thick perimeter and
  has ≥3:1 contrast against adjacent colors. A 2px offset solid ring satisfies this.

- **The input already does the right thing on Enter** (`App.jsx:133`). Good — keep it, but the Add
  button and the form should ideally be wrapped in a `<form>` with `onSubmit` so Enter is semantically
  a submit and the button is `type="submit"`. This also gives free browser behaviors.

- **After picking a winner, move focus** is *optional* here since the live region covers the
  announcement, but if you add a "Pick again" affordance, return focus to it.

- **Tab order is currently logical** (top-to-bottom), which is good — just make sure collapsed panels
  drop out of it (§1.2).

### 1.5 Hit-target sizes — WCAG 2.2 SC 2.5.8 (Target Size, Minimum, Level AA)

The new-in-2.2 AA criterion requires interactive targets to be **≥ 24×24 CSS px** (or have 24px
spacing). Industry best practice — Apple HIG and Material — is **44×44** (Apple) / **48×48**
(Material) for primary touch targets. Research cited by WCAG shows sub-44px targets have ~3x the
error rate.

Current offenders:
- `.remove-btn` (`App.css:118`): `padding: 0 4px` with a ~17px glyph → roughly **18×18px**. Fails AA.
  Set `min-width: 44px; min-height: 44px; display: inline-flex; align-items: center;
  justify-content: center;` and let the glyph stay small visually.
- `.help-chip` (`App.css:59`): `padding: 5px 12px` → ~26px tall. Squeaks past 24px AA but feels
  cramped. Bump to `min-height: 32px` (chips are a recognized exception to the 44px rule, but 32 is
  the comfortable floor used by Carbon/Material).
- `.help-toggle` / `.btn-copy`: text-only buttons with `padding: 0`. These are below 24px tall. Give
  them `min-height: 44px` (or treat them as inline-text links, which are exempt — but then style them
  as obvious links).

### 1.6 Color contrast — WCAG 2.2 SC 1.4.3 (text) & 1.4.11 (non-text)

Several values fail the 4.5:1 (normal text) / 3:1 (large text & UI components) thresholds against
their backgrounds (white `#fff` or cream `#f5f0eb`):

| Element | Color | BG | Ratio | Required | Verdict |
|---|---|---|---|---|---|
| `.subtitle` (`App.css:29`) | `#888` | `#fff` | ~3.5:1 | 4.5:1 | **Fail** |
| `.help-toggle` (`App.css:34`) | `#aaa` | `#fff` | ~2.3:1 | 4.5:1 | **Fail** |
| `.help-category-label` | `#aaa` | `#fff` | ~2.3:1 | 4.5:1 | **Fail** (small caps text) |
| `.remove-btn` resting | `#ccc` | `#fafafa` | ~1.6:1 | 3:1 (UI) | **Fail** |
| `.empty-hint` | `#bbb` | `#fff` | ~1.9:1 | 4.5:1 | **Fail** |
| `.btn-add` text `#fff` | on `#ff6b35` | — | ~3.0:1 | 4.5:1 | **Borderline fail** for body text |

Fixes: darken greys to at least `#767676` (the well-known 4.54:1-on-white value) for body text and
`#595959` for the subtitle/labels you want muted-but-legible. For the brand orange `#ff6b35`,
white text on it is ~3.0:1 — fine for large/bold button labels (≥18.66px bold counts as "large
text", 3:1) but tighten to `#e8551f` (~4.0:1) if you want a comfortable margin, or keep the orange
for fills and use it only as an accent, not for small text on white (the `.result` and winner text
in orange on white/cream is ~3:1 and should be enlarged/bolded to qualify as large text — it already
is `1.1rem` bold, so it just passes the large-text 3:1 bar).

### 1.7 Other semantic cleanups

- The page has an `<h1>` (good) but no `<main>` landmark. Wrap the card in `<main>`.
- The restaurant `<ul>` is correct semantics — keep it. Announce count changes via the same polite
  live region or an `aria-label` on the list ("3 restaurants added").
- The "Copied!" feedback (`App.jsx:97`) is visual-only; route it through a polite live region too so
  screen-reader users get the confirmation.
- Add a `<title>` and `lang="en"` on `<html>` (check `index.html`).

---

## 2. Motion & microinteractions

### 2.1 Adopt a small, named motion token system

Amateur UIs sprinkle arbitrary durations (`0.15s`, `0.2s`, `0.25s`, `0.3s`, `0.1s` all appear in the
current CSS). Enterprise design systems define a **tiny, reusable scale**. Use Material 3's
duration/easing tokens as the reference — they are the de-facto industry standard and map cleanly:

```css
:root {
  /* durations */
  --motion-short:   150ms;  /* hovers, small state changes */
  --motion-medium:  250ms;  /* expand/collapse, larger moves */
  --motion-long:    400ms;  /* full-card / entrance */

  /* easing (Material 3) */
  --ease-standard:           cubic-bezier(0.2, 0.0, 0, 1.0);   /* general */
  --ease-emphasized:         cubic-bezier(0.2, 0.0, 0, 1.0);   /* expressive */
  --ease-emphasized-decel:   cubic-bezier(0.05, 0.7, 0.1, 1.0);/* enters */
  --ease-emphasized-accel:   cubic-bezier(0.3, 0.0, 0.8, 0.15);/* exits */
}
```

**Rules of thumb (grounded in M3 + Apple HIG):**
- UI elements *entering* the screen should **decelerate** (start fast, ease to rest) — use
  `--ease-emphasized-decel`.
- Elements *leaving* should **accelerate** (`--ease-emphasized-accel`) and be ~30% faster than their
  entrance — exits should feel snappier than entrances.
- Small in-place changes (hover, color) use `--ease-standard` at `--motion-short`.
- Keep everything under ~400ms; UI motion over 500ms starts to feel sluggish (Material caps most
  component transitions at 200–400ms).

### 2.2 Fix the hover model — stop animating `opacity`

`button:hover { opacity: 0.85 }` (`App.css:93`) is the single clearest "amateur" tell. Lowering
opacity on hover makes solid buttons look disabled/washed-out and drags any text on them below
contrast thresholds. Linear/Stripe-class polish instead shifts **background-color/brightness** and
adds a subtle elevation:

```css
.btn-add { background: #ff6b35; color: #fff; transition: background-color var(--motion-short) var(--ease-standard); }
.btn-add:hover { background: #f25a22; }      /* darken, don't fade */
.btn-pick:hover { background: #2b2b2b; }
button:active { transform: translateY(0.5px) scale(0.99); } /* keep the press, soften it */
```

The current `transform: scale(0.97)` on `:active` (`App.css:94`) is fine in spirit but a 3% squish is
a bit much for an enterprise feel; `0.99` + a 0.5px nudge reads as "tactile" not "toy."

### 2.3 Collapse/expand panels — fix the `max-height` hack

`max-height: 0 → 400px` (`App.css:42-47`) is the classic CSS trick, but it has two problems:
1. The transition timing is wrong: because the real content height is far less than 400px, the panel
   appears to *finish opening early* and *delay before closing* (the browser animates to/from 400px,
   not the actual height). The eye notices.
2. Content stays in the tab order while collapsed (§1.2).

Better options, in order of polish:
- **Best (2024+):** animate `grid-template-rows: 0fr → 1fr` on a wrapper. This animates to the
  *actual* content height with no magic number:
  ```css
  .help-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--motion-medium) var(--ease-emphasized-decel); }
  .help-panel.open { grid-template-rows: 1fr; }
  .help-panel > * { overflow: hidden; }
  ```
- **Modern:** use `interpolate-size: allow-keywords` + `transition` on `height` to `auto`
  (Chrome 129+, progressive enhancement).
- Pair the open with a **content cross-fade** (`opacity 0→1` over `--motion-short`, slightly delayed)
  so chips fade in rather than being clipped — this is the detail that reads as "designed."

Use `--ease-emphasized-decel` for opening (250ms) and `--ease-emphasized-accel` for closing (~180ms).

### 2.4 The "spin to pick a winner" animation — the centerpiece decision

This is the app's signature moment, and it is currently both **gimmicky and unsafe**:
- It strobes the highlight every **80ms** (12.5 Hz). Flashing in the 3–55 Hz range is a
  **photosensitive-seizure risk** and brushes **WCAG 2.3.1 (Three Flashes)**. Rapid full-row
  background flips are exactly the pattern WCAG warns about.
- A roulette/slot-machine effect signals "casino game," which is the opposite of "enterprise
  professional."

You have two defensible directions:

**Option A — Tone it down (recommended for an enterprise feel).** Replace the strobe with a single,
calm reveal:
1. On "Pick," disable the button and show a brief, quiet "Choosing…" state (~600–900ms total, not
   1.2s) — e.g. a subtle indeterminate progress bar or pulsing the Pick button, *not* row flashing.
2. Then reveal the winner with **one** emphasized transition: the winning row scales `1 → 1.02`,
   its border/background animates to the highlight color over `--motion-medium` with
   `--ease-emphasized-decel`, and the result text cross-fades in. One confident move beats 15 frantic ones.

**Option B — Keep a refined "cycle," done premium.** If product wants the suspense, slow and ease it:
- Cap the cycling so the **last few steps decelerate** (ease-out the interval: 80ms → 120 → 180 →
  260 → 360ms) so it visibly "settles" on the winner like a well-engineered spinner, instead of
  cutting off mid-strobe. This is the difference between a slot machine and a Stripe-grade reveal.
- Ensure the highlight transition between steps is a **smooth color tween (≥150ms)**, never an
  instant flip, which both removes the flash risk and looks intentional.
- Keep total time ≤1.0s; suspense past ~1s feels like lag.

Either way, **add a winner "celebration" that's tasteful**: a one-shot scale-pop (1 → 1.04 → 1.0,
`--motion-medium`, emphasized) on the winning row. Skip confetti for enterprise.

### 2.5 `prefers-reduced-motion` — mandatory, currently missing entirely

There is **no** reduced-motion handling anywhere. For users with vestibular disorders, ADHD, or
photosensitivity this app is, at best, uncomfortable and, with the 80ms strobe, potentially harmful.
WCAG 2.3.3 (Animation from Interactions, AA) requires non-essential motion be disable-able.

"Reduced" does **not** mean "none" — keep tiny, non-vestibular cues (opacity cross-fades are the safe
default) and kill anything that scales/translates/strobes:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

But handle the **spinner explicitly in JS**, because a CSS reset won't stop the 80ms `setInterval`:

```js
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function pickRandom() {
  if (!entries.length) return;
  if (reduceMotion) {
    // skip the cycle entirely: pick instantly, announce via live region
    const w = entries[Math.floor(Math.random() * entries.length)][1];
    set(winnerRef, w);
    return;
  }
  // …animated path…
}
```

Best-in-class teams (and the cited guidance) also recommend an **in-UI toggle**, since not everyone
sets the OS preference — but at minimum honor the media query.

### 2.6 Microinteraction polish details (the "pro" layer)

- Animate the `.result` / winner reveal, never let text pop in instantly.
- The "Copied!" label swap should fade, and ideally the button briefly shows a check icon.
- Disable `.btn-pick` while `spinning` and reflect it visually (`opacity`/`cursor: not-allowed` +
  `aria-disabled`), so it can't be re-triggered mid-spin.
- Add `transition` to the `:focus-visible` ring so focus *eases* in (120ms) rather than snapping.
- Newly added restaurant rows should animate in (height + fade, emphasized-decel) so the list feels
  alive; removed rows should animate out before unmounting.

---

## 3. Responsive behavior

### 3.1 The fixed 460px card is the core problem

`App.css:24` hard-codes `width: 460px` with `padding: 40px`. On a 360px-wide phone (and especially
320px), the card overflows horizontally, forcing a page-level scroll and clipping. This is the most
visible "not built for mobile" failure.

Replace fixed width with a fluid, capped width plus responsive padding:

```css
.card {
  width: min(460px, 100% - 32px);  /* never exceed viewport, 16px gutters each side */
  padding: clamp(20px, 5vw, 40px); /* tighter padding on small screens */
  margin-inline: auto;
}
```

`min(460px, 100% - 32px)` keeps the desktop look identical while guaranteeing it shrinks gracefully.
`clamp()` on padding is the modern, breakpoint-free way to scale internal spacing.

### 3.2 Breakpoints & layout shifts

Use a single, well-chosen mobile breakpoint (the redesign doesn't need a complex grid):

```css
@media (max-width: 480px) {
  .page { align-items: flex-start; }          /* stop vertical centering; let it scroll naturally */
  .card { border-radius: 12px; margin-top: 24px; }
  .input-row { /* stays a row; Add button stays inline */ }
  .help-chips { gap: 8px; }                    /* slightly more tap spacing */
}
```

Notes:
- **Don't vertically center on mobile.** A centered card whose content exceeds viewport height gets
  clipped at the top with no scroll affordance. Switch `align-items` to `flex-start` below the
  breakpoint (Carbon and Apple both pin content to top on small screens).
- Keep the input + Add button on one row (they fit), but ensure both meet 44px touch height.
- The Share URL (`.share-box span`, `App.css:143`) already truncates with ellipsis — good for mobile.

### 3.3 Mobile-specific polish

- **Safe-area insets** for notched devices: `padding-bottom: max(24px, env(safe-area-inset-bottom));`
  on the page so the card clears the home indicator.
- **Prevent iOS zoom-on-focus:** the input font-size is `1rem` (16px) — keep it ≥16px (`App.css:78`
  is fine; never drop below 16px or Safari auto-zooms).
- **Set the viewport meta** (verify in `index.html`):
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Consider a max content width on very large screens is unnecessary here (card is already capped).
- Test at 320px (iPhone SE / smallest supported), 360px, 390px, and 768px.

---

## 4. "Enterprise polish" details that separate amateur from professional

These are small, cheap, and disproportionately raise perceived quality (the Linear/Stripe layer):

1. **A real focus system** (§1.4). Visible, consistent, eased `:focus-visible` rings are the #1
   signal that a team takes craft seriously.
2. **A motion token scale** (§2.1) instead of one-off durations — consistency *is* the polish.
3. **Darken-don't-fade hovers** and restrained press states (§2.2).
4. **Fluid sizing with `min()`/`clamp()`** rather than fixed pixels (§3.1).
5. **Spacing rhythm:** the current margins (8/12/16/20/24px) are close to an 8px grid but not
   disciplined. Snap everything to a 4px base scale (4/8/12/16/24/32/40) and use it via CSS vars.
6. **Disabled states:** the Pick and Add buttons currently look identical whether actionable or not
   (e.g., Pick with an empty list silently no-ops at `App.jsx:76`). Show a true disabled state with
   `:disabled` styling + `aria-disabled`, and disable Add when the input is empty.
7. **Optical detail:** softer, layered shadows beat a single blurry one. Replace
   `0 4px 24px rgba(0,0,0,0.08)` (`App.css:25`) with a two-layer shadow
   (`0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`) for a more refined elevation.
8. **Reduced-motion + dark-mode awareness** signal maturity; at minimum ship reduced-motion now.
9. **Empty/loading states:** the "No restaurants yet" hint (`App.jsx:140`) is good — extend the
   pattern to a loading skeleton while Firebase hydrates, so the card doesn't flash empty→full.
10. **Consistent iconography:** the `×` glyph is a typographic stand-in; a proper 16px icon (or an
    SVG) inside a 44px hit area looks intentional rather than improvised.

---

## 5. Prioritized action list

**P0 — correctness / legal-risk (do first):**
- `aria-label` on every `×` remove button (§1.1).
- Polite live region announcing the winner (§1.3).
- `prefers-reduced-motion` handling + de-strobe the 80ms spinner (§2.5, §2.4) — flash-safety.
- Visible `:focus-visible` styles; remove blanket `outline: none` (§1.4).
- Fix contrast failures on greys (§1.6).

**P1 — core UX / responsiveness:**
- Fluid card width with `min()` + `clamp()` padding; mobile breakpoint; top-align on mobile (§3).
- `aria-expanded`/`aria-controls` + `hidden`/`inert` on both collapsibles (§1.2).
- 44px hit targets on remove/toggle buttons (§1.5).
- Motion token system; darken-don't-fade hovers (§2.1, §2.2).

**P2 — polish:**
- `grid-template-rows` collapse animation with content cross-fade (§2.3).
- Refined winner reveal + tasteful pop (§2.4).
- Layered shadow, 4px spacing scale, disabled states, row enter/exit animation (§4).

---

## Sources

- [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/)
- [Understanding SC 2.5.8 Target Size (Minimum)](https://www.digitalpolicy.gov.hk/en/our_work/digital_government/digital_inclusion/accessibility/promulgating_resources/handbook/wcag2aa/9_17_target_size_min.html) and [TestParty: WCAG 2.5.8 guide](https://testparty.ai/blog/wcag-target-size-guide)
- [Understanding SC 2.3.3 Animation from Interactions — W3C/WAI](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- [Material Design 3 — Easing and duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) and [M3 Motion overview](https://m3.material.io/styles/motion/overview/how-it-works)
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) and [Tatiana Mac — no-motion-first](https://www.tatianamac.com/posts/prefers-reduced-motion)
- [Pope Tech — Designing accessible animation (2025)](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [ARIA live regions cheatsheet — polite vs assertive](https://rightsaidjames.com/2025/08/aria-live-regions-when-to-use-polite-assertive/) and [MDN — aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded)
- [GOV.NZ — Disclosures and accordions](https://govtnz.github.io/web-a11y-guidance/wct/disclosures-and-accordions/)
- [WebAIM — Introduction to ARIA](https://webaim.org/techniques/aria/)
