# Meal Picker — Component Design Patterns Research

**Dimension:** Component design patterns (buttons, inputs, chips/tags, list items, empty states, feedback)
**Goal:** Move from "crowded and clunky" to an enterprise-professional look grounded in 2025 best practice.
**References:** Shopify Polaris, IBM Carbon, Material 3, Atlassian, Ant Design, Stripe, Vercel (Geist), Linear.

---

## 0. What's wrong today (component audit)

Reading `src/App.css`, the current build breaks several pro conventions:

| Issue | Current | Why it reads as "clunky" |
|---|---|---|
| **Global `button` reset** | One rule styles every button; hierarchy expressed only by color | No real tier system; `:hover { opacity: 0.85 }` dims everything identically (an anti-pattern — pros change *color*, not opacity) |
| **Hover = opacity** | `button:hover { opacity: 0.85 }` | Opacity fade looks like a disabled/loading state, not an affordance. Enterprise systems shift background/border tokens |
| **Focus removed** | `input { outline: none }`, no `:focus-visible` anywhere | Accessibility failure (WCAG 2.4.7). No keyboard focus ring at all |
| **Borders too heavy** | `2px` borders on inputs and list items | Pros use `1px` borders; 2px reads as "wireframe/draft" |
| **Inconsistent radii** | 8px, 10px, 16px, 20px mixed with no scale | No concentric radius system |
| **Help link is near-invisible** | `color: #aaa` underlined | Fails 3:1 contrast; tertiary actions should still be legible |
| **Feedback is text-swap only** | "Copied!" via button label, winner via inline text | No toast, no motion choreography, no `aria-live` |

The fixes below are organized by component.

---

## 1. Button hierarchy

Enterprise systems converge on a **4-tier hierarchy** plus a destructive variant. Carbon and Polaris both stress: *one* high-emphasis (primary) button per view, everything else steps down. With more than ~3 CTAs in a layout, use tertiary/ghost rather than stacking secondaries (Carbon guidance).

### Recommended tiers and tokens

Define one base button and vary by tier. Suggested tokens (light theme):

```
--btn-radius: 8px;          /* dense interactive elements; Stripe uses 4px, Vercel 6px, Polaris ~8px */
--btn-height-md: 40px;      /* default; 36px compact, 48px large */
--btn-pad-x: 16px;
--btn-font: 14px/1 600;     /* 14px, weight 600 */
--focus-ring: 0 0 0 3px rgba(255,107,53,0.35);  /* brand-tinted, 3px, ~3:1 */
```

| Tier | Use | Rest | Hover | Active | Focus | Disabled |
|---|---|---|---|---|---|---|
| **Primary** (filled) | The single most important action | bg `#ff6b35`, text white | bg darken ~8% (`#f15a23`) | darken ~12% | add `--focus-ring` | bg `#f3d9cd`, text `#fff`, `cursor:not-allowed`, no shadow |
| **Secondary** (outline) | Important but not the main action | transparent, `1px` border `#d9d4cf`, text `#1a1a1a` | bg `#f5f0eb`, border `#c4bdb6` | bg `#ece6df` | `--focus-ring` | text + border `#cfccc9` |
| **Tertiary** (subtle/tonal) | Repeated/list-level actions | bg `#f5f0eb`, no border, text `#1a1a1a` | bg `#ece6df` | bg `#e2dbd2` | `--focus-ring` | text `#bbb` |
| **Ghost / text** | Lowest-emphasis, inline | transparent, text `#6b6b6b` | bg `rgba(0,0,0,0.04)` | `rgba(0,0,0,0.08)` | `--focus-ring` | text `#bbb` |

**Universal rules**
- Replace `:hover { opacity }` with **background/border token shifts**. Opacity changes are reserved for disabled.
- Use `:focus-visible` (not `:focus`) so the ring shows for keyboard users only — Stripe/Vercel pattern. Ring spec: ≥3px, ≥3:1 contrast (WCAG).
- Keep `:active { transform: scale(0.98) }` — it's fine and gives tactile feedback; pros also pair active with the darkest token.
- Min hit target 40px height (Material 3 prefers 48px for touch).

### Mapping THIS app's buttons

| Element | Current | Recommended tier | Notes |
|---|---|---|---|
| **Pick one** | black filled, full width | **Primary** | This is the app's hero action. Make it the *only* primary. Use brand `#ff6b35`, not black — black competes with type and reads generic. |
| **Add** | brand filled | **Secondary** (outline) | Currently a second filled brand button competes with Pick. Demote to outline so Pick wins the eye. |
| **Help chips** | brand-tint chips | **Tertiary/assist chip** (see §3) | These are add-shortcuts, not primary buttons. |
| **Need help? Browse options** | gray underline | **Ghost/text** | Legible (`#6b6b6b`), no underline, optional chevron icon that rotates on open. |
| **Share** | beige full-width | **Secondary** or **Ghost** | A full-width button for a low-frequency action over-weights it. Make it a left-aligned text+icon toggle. |
| **Copy link** | brand text | **Tertiary** small / icon button | Pair with a clipboard icon. |
| **× remove** | gray text | **Ghost icon button** (destructive on hover) | See §4. |

---

## 2. Input field styling

Stripe and Vercel both use **1px borders**, a small radius, and a **box-shadow focus ring** (not a removed outline).

### Recommended input tokens

```
height: 40px;               /* match button md */
padding: 0 12px;
border: 1px solid #d9d4cf;  /* down from 2px #e5e5e5 */
border-radius: 8px;
font-size: 15px;
background: #fff;
color: #1a1a1a;
```

States:
- **Hover:** `border-color: #c4bdb6`
- **Focus (`:focus-visible`):** `border-color: #ff6b35; box-shadow: 0 0 0 3px rgba(255,107,53,0.15)` — Stripe's signature soft-ring move (their actual token is `rgba(99,91,255,0.1) 0 0 0 3px`).
- **Placeholder:** `color: #9a948e` — must stay ≥3:1 but visibly lighter than entered text. Today's `#888` is acceptable; keep placeholders short and never use them as the only label.
- **Disabled:** `background: #f5f0eb; color: #bbb`.

**Add-row layout:** keep input + button in a flex row, gap 8px, but the two should share the same 40px height for a clean baseline. Right now input is `10px 14px` and button `10px 18px` — they don't visually align.

---

## 3. Chips / tags (suggestion options)

In Material 3 terms these are **assist/suggestion chips** — single-tap shortcuts that perform an action (add a restaurant). They are NOT removable input chips (the removable pattern belongs to the *added* list, see §4).

### Recommended chip spec

```
height: 32px;
padding: 0 12px;
border-radius: 16px;        /* pill = correct for chips; keep this radius distinct */
border: 1px solid #e2dbd2;  /* M3 outlined assist chip */
background: #fff;
font-size: 13px; color: #444;
```

- **Hover:** `background: #f5f0eb; border-color: #c4bdb6` (subtle), or the existing brand-tint `#ffe8dc / #ff6b35` if you want chips to feel "tappable to add." Brand-tint hover is fine and on-brand — just make sure rest state has a visible 1px border so the chip looks interactive at rest (M3: chips need a secondary indicator of interactivity beyond color).
- **Leading "+" icon** optional but clarifies "tap to add."
- **Touch target:** M3 warns chip height can fall below the 48px target; ensure adequate spacing (gap 8px) so mis-taps are rare.
- **Already-added state:** dim/disable a chip once its restaurant is in the list (checkmark or muted style) — prevents duplicate-add confusion. High-value, low-effort.

### Presenting the help panel

- The category labels (`Burgers`, `Pizza`…) as uppercase 12px overline labels is correct and on-pattern.
- The panel itself reads as crowded because chips + categories + the toggle all stack tightly. Add `12–16px` vertical rhythm between categories and give the panel a faint top divider (`1px solid #f0ece7`) so it's clearly a disclosure region.
- Consider a real **disclosure pattern**: chevron icon on the toggle that rotates 180° on open, plus `aria-expanded`. The current max-height transition is fine for motion.

---

## 4. List items (added restaurants)

This is the core content list. Pros (Linear, Polaris resource lists) keep rows **quiet at rest** and reveal affordances on hover.

### Recommended row spec

```
display: flex; align-items: center; justify-content: space-between;
min-height: 44px;
padding: 8px 12px;
border-radius: 8px;
background: transparent;       /* not #fafafa for every row */
border: 1px solid transparent; /* reserve space; no 2px boxes */
```

- **Rest:** transparent background, divider-style separation (a `1px` bottom border `#f0ece7`) OR a very light card — pick one, not both. Today every row is a `#fafafa` box with a `2px` border, which is visually noisy at 5+ items. Switch to **row dividers** for a calmer list.
- **Hover:** `background: #f9f6f2` and reveal the remove button (fade in). Linear/Gmail pattern — controls hidden until hover keeps the list scannable.

### Remove affordance

- Today: a faint `×` glyph always visible, turns red on hover. Upgrade to a **ghost icon button**, 28×28 hit area, icon `#bbb` at rest → `#e53e3e` on its own hover, with `aria-label="Remove {name}"`.
- Reveal on row-hover (opacity 0 → 1), but keep it **always visible on touch / small screens** (no hover there).
- Consider an **Undo** affordance (toast with Undo) instead of instant destructive removal — Polaris/Material pattern for reversible deletes. Higher effort; flag as optional.

### Winner-highlight state

The winner state is the app's payoff — pros choreograph it:
- **Resting winner:** `background: #fff4ee; border: 1px solid #ff6b35; color: #ff6b35; font-weight: 700` (current look is good) — plus a small trophy/check icon or a "Winner" badge chip on the right.
- **During spin:** the cycling highlight is good. Ensure the transition between cells is snappy (the 80ms tick is fine) and the *final* land has a distinct beat — e.g., a one-shot scale pop (`transform: scale(1.03)` then settle) + the soft shadow grows. This "lift on resolve" is the elevation-on-interaction pattern.
- Announce the winner via `aria-live="polite"` so screen readers get the result.

---

## 5. Empty state

"No restaurants yet." is a literal-empty state — the #1 thing 2025 guidance says to avoid. An empty state should **orient, instruct, and invite action** (it's the user's first impression).

### Recommended empty state

A centered, low-key block inside the list region:
- **Icon/illustration:** a small muted glyph (plate/fork, ~32–40px) — keep it subtle, not a big illustration for such a small card.
- **Headline:** "No restaurants yet" (16px, `#1a1a1a`).
- **Helper line:** "Add one above, or pick from suggestions." (13px, `#9a948e`).
- **Optional CTA:** a ghost button "Browse suggestions" that opens the help panel — directly converts the empty state into the next action (SaaS best practice: empty states should convert).
- **Accessibility:** wrap in `aria-live` so AT users are told when the list empties/fills.

Keep it to ~3 lines so it doesn't add to the "crowded" feeling.

---

## 6. Feedback / micro-interactions

Two moments need real micro-feedback: **copy confirmation** and **winner reveal**.

### "Copied!" confirmation

Current label-swap (`Copy link` → `Copied!` for 2s) is acceptable and common, but the pro upgrade is a **toast**:
- Toast spec (per Adobe Spectrum / Fluent / Polaris): short, non-intrusive, auto-dismiss ~3–4s, consistent screen position (bottom-center or bottom-left), neutral or success-green, one line of text, optional action.
- Message: "Link copied to clipboard." Add `role="status"` / `aria-live="polite"`.
- If you keep the inline pattern (reasonable for an app this small), at least add a **check icon** on success and a 150ms cross-fade rather than an instant text swap. Don't change button width when the label changes (reserve min-width) — width jump is a classic clunky tell.

### Winner reveal

This is the emotional peak — invest here:
- Sequence: spin decelerates → lands on winner → winner row does a **scale pop + shadow lift** → result text fades/slides in below.
- Result text "Let's go to {winner}!" is good copy; animate it in (`opacity` + 4px translateY, 200ms) rather than appearing instantly.
- Optional delight: a brief confetti burst or a single subtle pulse — keep it under ~600ms so it stays "professional, with personality" rather than gimmicky.
- Respect `@media (prefers-reduced-motion: reduce)` — disable spin/confetti, just reveal the result. This is a required enterprise/accessibility detail.

### General feedback rules
- Max 1 toast at a time here; never stack.
- Feedback colors: success green for copy, brand orange for winner. Don't overuse semantic color.

---

## 7. Radius, shadow, and elevation system

Adopt a small **token scale** instead of the current ad-hoc 8/10/16/20px mix. Pros enforce a concentric rule: **child radius ≤ parent radius** (Vercel).

### Radius scale (recommended)

```
--radius-pill: 999px;   /* chips */
--radius-sm: 6px;       /* inputs, small buttons (optional) */
--radius-md: 8px;       /* buttons, list rows, inputs */
--radius-lg: 12px;      /* the card */
```

Note: drop the card from 16px → 12px, keep interactive elements at 8px. That keeps the card radius comfortably larger than its children (concentric). 16px is also fine for the card if you bump nothing inside above 8–10px — the key is the *relationship*.

### Elevation scale (recommended)

Production systems define 4–6 elevation tokens, each a **two-layer shadow** (tight key shadow + soft ambient):

```
--elev-0: none;                                            /* rest rows, inputs */
--elev-1: 0 1px 2px rgba(0,0,0,0.06),
          0 1px 3px rgba(0,0,0,0.04);                      /* chips on hover, subtle */
--elev-2: 0 4px 8px rgba(0,0,0,0.06),
          0 2px 4px rgba(0,0,0,0.04);                      /* the card (replaces 0 4px 24px) */
--elev-3: 0 12px 24px rgba(0,0,0,0.10),
          0 4px 8px rgba(0,0,0,0.06);                      /* toast, winner pop */
```

- The current card shadow `0 4px 24px rgba(0,0,0,0.08)` is a single soft blur — fine but flat. The two-layer `--elev-2` reads crisper and more "designed."
- **Interaction = increase contrast/elevation, not decrease** (Vercel). On the winner pop, go `--elev-0 → --elev-3`.
- Keep shadows subtle but *meaningfully different* between layers (the elevation principle: layers with different meaning should look different, not just blurrier).

---

## 8. Priority recommendations (effort vs. impact)

| Priority | Change | Effort |
|---|---|---|
| P0 | Add `:focus-visible` rings to all buttons/inputs; stop removing outline | Low |
| P0 | Replace `:hover { opacity }` with background/border token shifts | Low |
| P0 | Establish button tiers: Pick = primary (brand), Add = secondary outline | Low |
| P0 | Inputs/rows: `1px` borders (not 2px); align input + Add to 40px height | Low |
| P1 | List rows: dividers + hover-reveal remove button (ghost icon, aria-label) | Med |
| P1 | Real empty state (icon + helper + "Browse suggestions" CTA) | Low |
| P1 | Radius + elevation token scale; two-layer card shadow | Low |
| P2 | Toast for copy; choreographed winner reveal + reduced-motion guard | Med |
| P2 | Chip "already added" state; chip leading "+" icon | Med |

---

## Sources

- [Carbon Design System — Button usage](https://carbondesignsystem.com/components/button/usage/)
- [Shopify Polaris Design System](https://community.shopify.com/t/polaris-design-system/364843)
- [Material Design 3 — Chips (accessibility)](https://m3.material.io/components/chips/accessibility)
- [Ant Design — Tag](https://ant.design/components/tag/)
- [MUI — Chip component](https://mui.com/material-ui/react-chip/)
- [MDN — :focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible)
- [Sara Soueidan — Designing WCAG-conformant focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [Visible Focus Rings: A Practical Guide (72Technologies)](https://www.72technologies.com/blog/focus-rings-visible-focus-guide)
- [Stripe design system token breakdown (DesignMD)](https://designmd.cc/benchmarks/stripe)
- [Vercel — Web Interface Guidelines](https://vercel.com/design/guidelines)
- [Vercel Geist — Input](https://vercel.com/geist/input)
- [Telerik Design System — Border radius usage](https://www.telerik.com/design-system/docs/foundation/border-radius/usage/)
- [Atlassian Design — Elevation](https://atlassian.design/foundations/elevation)
- [Designsystems.surf — Elevation patterns: tokens, shadows, roles](https://designsystems.surf/articles/depth-with-purpose-how-elevation-adds-realism-and-hierarchy)
- [USWDS — Shadow tokens](https://designsystem.digital.gov/design-tokens/shadow/)
- [Adobe Spectrum — Toast](https://spectrum.adobe.com/page/toast/)
- [Fluent 2 — Toast usage](https://fluent2.microsoft.design/components/web/react/core/toast/usage)
- [LogRocket — Toast notification UX best practices](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Eleken — Empty state UX examples and rules](https://www.eleken.co/blog-posts/empty-state-ux)
- [Carbon Design System — Notification pattern](https://carbondesignsystem.com/patterns/notification-pattern/)
