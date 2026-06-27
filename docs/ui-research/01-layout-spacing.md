# Meal Picker UI Redesign — Layout, Spacing & Visual Hierarchy

> Research dimension: **Layout, spacing, and visual hierarchy.**
> Goal: take the current "crowded and clunky" card and rework it to read as *enterprise professional*, grounded in 2025 best practice from IBM Carbon, Atlassian, Shopify Polaris, Material 3, and the modern-pro aesthetic of Linear / Stripe / Vercel.

---

## 1. Diagnosis — why the current card feels crowded & clunky

Reading `src/App.css`, the root causes are structural, not cosmetic:

| Problem | Evidence in current CSS | Effect |
|---|---|---|
| **No spacing system** | Values are `8, 6, 12, 20, 16, 24, 40, 5, 14, 10px` — ad hoc, not on any grid | Nothing lines up; the eye can't find rhythm, which *reads* as clutter even when density is fine |
| **One flat visual plane** | Every block (`help`, `input-row`, `list`, `pick`, `share`) sits at the same indent with only `margin-bottom: 20px` between them | No grouping — 6 sections look like 6 equally-important things competing for attention |
| **Uniform `20px` gaps everywhere** | `subtitle`, `help-toggle`, `help-panel`, `input-row` all use `margin-bottom: 20px` | Related items aren't visually closer than unrelated ones — violates proximity, the #1 driver of "tidy vs. crowded" |
| **Too many competing emphasis cues** | Orange `#ff6b35` on chips-hover, Add button, focus ring, winner row, result text, copy link — plus a near-black "Pick" *and* "Share" button of equal weight | Multiple "loudest things." Linear/Stripe/Vercel deliberately have *one* visual climax per view |
| **Weak hierarchy on labels** | Title `1.8rem`, but help-toggle and subtitle are both grey low-contrast (`#888`/`#aaa`); the primary action ("Pick one") is visually the same weight as the secondary "Share" | Primary/secondary/tertiary are not differentiated |
| **Clunky collapsibles** | `max-height: 400px` magic number + `max-height: 60px` for share; abrupt, and the help-toggle is tiny underlined grey text | Disclosure feels like an afterthought, not a designed state |

The fix is **not** "add more whitespace everywhere" — it's **systematize spacing, then redistribute it** so grouping does the work.

---

## 2. The spacing scale (adopt a 4 / 8px base grid)

Every major system converges on the same primitive: an **8px base unit with a 4px half-step** for tight, component-level spacing.

- **IBM Carbon** — built on the *2x Grid*, an 8px mini-unit; spacing tokens are multiples of 2/4/8. ([Carbon spacing](https://carbondesignsystem.com/elements/spacing/overview/))
- **Atlassian** — `space.100 = 8px` is the base; tokens are percentages of it (`space.200 = 16px`, `space.400 = 32px`). ([Atlassian spacing](https://atlassian.design/foundations/spacing))
- **Shopify Polaris** — everything (including line-heights) snaps to a **4px** grid. ([Polaris spacing](https://legacy.polaris.shopify.com/design/spacing))
- **Material 3** — system spacing tokens; density changes by stepping padding in 4dp increments. ([M3 spacing](https://m3.material.io/styles/spacing/tokens))

### Recommended token set for Meal Picker

Define these once as CSS custom properties and **never type a raw pixel value again**:

```css
:root {
  --space-1:  4px;   /* hairline: icon↔label, chip inner */
  --space-2:  8px;   /* tight: within a control row */
  --space-3:  12px;  /* compact: list-item padding, chip gaps */
  --space-4:  16px;  /* default: inside-group spacing */
  --space-5:  24px;  /* between sub-groups */
  --space-6:  32px;  /* between major sections */
  --space-8:  48px;  /* card padding (desktop) */
}
```

This maps cleanly to Atlassian's three usage bands, which is the most actionable framing for this app:

| Band | Tokens | Use for |
|---|---|---|
| **Compact** (0–8px) | `--space-1`, `--space-2` | inside a single control: input padding, chip padding, gap between input and Add button |
| **Default** (12–24px) | `--space-3`, `--space-4`, `--space-5` | inside a section: list rows, gaps between a label and its content |
| **Layout** (32–48px) | `--space-6`, `--space-8` | between the five major sections, and card padding |

> **Rule of thumb to kill the "crowded" feeling:** the gap *between* sections (`--space-6`, 32px) must be visibly larger than the gap *within* a section (`--space-4`, 16px). Right now they're both ~20px, which is the core bug.

---

## 3. Card sizing, padding & vertical rhythm

### Card
- **Width:** keep **`460px` max-width**, but make it `width: 100%; max-width: 460px;` so it survives narrow viewports. 440–480px is the sweet spot for a single-column form (Stripe checkout ≈ 448px).
- **Padding:** bump from the current flat `40px` to **`48px` (`--space-8`) top/bottom, `40px` left/right** — slightly more vertical breathing room. On screens < 520px, drop to `24px` (`--space-5`).
- **Radius:** `16px` is fine and on-trend; keep it. (Optionally `12px` for a slightly more "enterprise/Stripe" feel — large radii read more "consumer.")
- **Shadow:** soften and layer it. A single `0 4px 24px rgba(0,0,0,.08)` is fine but flat. Modern pro look = two stacked shadows:
  ```css
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
  ```
  Plus a `1px solid rgba(0,0,0,.06)` hairline border — Linear/Vercel almost always pair a soft shadow with a crisp 1px edge.

### Vertical rhythm — the section stack

Replace the per-element `margin-bottom: 20px` scatter with a **single gap owner** on the card:

```css
.card { display: flex; flex-direction: column; gap: var(--space-6); } /* 32px between sections */
```

Then *within* each section, use `--space-3`/`--space-4`. This one change does ~70% of the de-cluttering, because it enforces "sections far apart, contents close together" automatically.

Target rhythm (top → bottom):

```
[ Title block            ]   title→subtitle gap = --space-2 (8px)
        ↕ 32px (--space-6)
[ Help disclosure        ]
        ↕ 32px
[ Add input row          ]   input↔Add gap = --space-2 (8px)
        ↕ 24px (--space-5)   ← tighter: list is the *result* of the input above it
[ Restaurant list        ]   rows gap = --space-2 (8px), row padding = --space-3 (12px)
        ↕ 32px
[ Pick one (primary CTA) ]
        ↕ 24px
[ Share disclosure       ]
```

Note the input→list gap is intentionally one step *tighter* (24px) than other section breaks — they're a producer/consumer pair, so proximity should bind them.

---

## 4. Reducing the "crowded" feeling — grouping & separation

Three concrete moves, in priority order:

**1. Group into 3 zones, not 6 flat blocks.** Mentally (and visually) the card has three jobs:
   - **Input zone** — title + help + add-row + list (everything about *building* the list)
   - **Action zone** — the "Pick one" CTA + result (the *climax*)
   - **Utility zone** — Share (low-priority housekeeping)

   Give the Action zone the most surrounding whitespace (it's the payoff), and visually demote the Utility zone (see §5). You can reinforce zone boundaries with a **hairline divider** (`1px solid #ececec` / `rgba(0,0,0,.06)`) *only* above the Share section — one divider, not many. Carbon/Polaris use dividers sparingly; a divider before every section would re-introduce clutter.

**2. Let whitespace, not boxes, do the separating.** Avoid the temptation to put borders around each section. The list items already have borders (`2px solid #f0f0f0`) — soften those to `1px solid #ececec` so the *rows* don't compete with the *card*. Nested heavy borders are a top cause of "busy."

**3. Quiet the chrome.** The help-toggle's underlined grey text and the equal-weight Share button both add noise. Treat both as tertiary (§5). Reduce the chip background contrast: chips on a cream card currently use the *same* cream (`#f5f0eb`) as the page bg — give chips a neutral `#f4f4f5` so they read as interactive, and reserve cream for the page only.

---

## 5. Visual hierarchy — primary / secondary / tertiary

The governing principle from every source: establish hierarchy with **size + weight + color + spacing**, and have exactly **one** primary element per view (Polaris: "using the same body size everywhere makes it hard to identify key elements"; Material 3: distinct primary/secondary/tertiary roles). Linear/Stripe/Vercel push this further — *aggressive contrast, one climax, everything else recedes.*

### Three tiers for Meal Picker

| Tier | Elements | Treatment |
|---|---|---|
| **Primary** | **"Pick one" button**, the **winner/result** | Pick = full-width, solid, the highest-contrast control on the card (keep near-black `#1a1a1a` *or* go brand-orange — but pick ONE accent owner; see below). Winner row = the only place orange fill + bold appears in resting state. |
| **Secondary** | Title (`1.5–1.75rem`, weight 600, `#18181b`), the **Add** button, the **input** field, **restaurant rows** | Visible and usable but quieter than the CTA. Add button can be a *secondary* style (outline or tonal), not another loud solid — the input row is data-entry, not the climax. |
| **Tertiary** | Subtitle, "Need help?" toggle, "Share" toggle, copy link, remove ×, category labels, empty hint | Low-contrast grey (`#71717a` for readable secondary text, `#a1a1aa` for the faintest). Small (`0.8–0.875rem`). These should *disappear* until looked for. |

### Fix the accent-color overload
Orange currently appears on: chip hover, Add button, input focus, winner row, result text, copy link. That's 6 owners of "the loud color." **Cut to two contexts:** (a) the **winner state** (fill + text), and (b) **focus/interaction affordances** (input focus ring, chip hover, link). Make the **Add** button a neutral/tonal secondary so orange means "this is the outcome," not "this is everything." This single change makes the card look dramatically more intentional — it's exactly the Vercel "looks expensive because of what they *don't* use" principle.

### Type scale (snap to the grid, Polaris-style)
| Role | Size | Weight | Color | Line-height |
|---|---|---|---|---|
| Title | `28px / 1.75rem` | 600 | `#18181b` | `32px` |
| Subtitle | `14px / 0.875rem` | 400 | `#71717a` | `20px` |
| Body / list item | `15px` | 500 | `#27272a` | `20px` |
| Category label | `12px` | 600, `letter-spacing .04em`, uppercase | `#a1a1aa` | `16px` |
| Toggles / links | `13px` | 500 | `#71717a` | `16px` |

(Consider the **Inter** typeface — it's what Polaris, Linear, and Vercel all use; the current system-font stack is fine but Inter reads more "product.")

---

## 6. Making the collapsible sections feel designed, not clunky

The two disclosures (Help, Share) are the clunkiest part. Fixes:

**1. Make the trigger look like a control, not afterthought text.**
   - Help toggle: replace tiny underlined grey text with a proper **tertiary text-button**: `13px`, weight 500, `#71717a`, with a **caret/chevron icon** that rotates 180° on open (`transition: transform .2s`). This is the Carbon/Polaris disclosure convention and instantly reads as "expandable."
   - Add a hover background (`#f4f4f5`, radius `8px`, padding `6px 8px`) so it has a hit-target, not just text.

**2. Fix the animation.** The `max-height: 400px` / `60px` magic numbers cause janky easing (the content finishes before the timer). Two clean options:
   - **Cheapest correct fix:** animate `grid-template-rows: 0fr → 1fr` on a wrapper (`overflow: hidden`), which animates to *actual* content height with no magic number:
     ```css
     .help-panel { display: grid; grid-template-rows: 0fr;
       transition: grid-template-rows .25s ease; }
     .help-panel.open { grid-template-rows: 1fr; }
     .help-panel > div { overflow: hidden; }
     ```
   - Use a consistent **200–250ms ease** for both panels (Material/Atlassian motion range). Currently Help is `0.3s` and Share is `0.25s` — unify them.

**3. Default the Help panel sensibly & give opened panels a "home."** When open, the help panel should sit on a subtly inset surface (`background:#fafafa; border-radius:12px; padding: var(--space-4)`) so it reads as a *contained tray* rather than loose chips spilling into the card. Tighten chip gap to `--space-2` (8px) and row gap between categories to `--space-3` (12px).

**4. Share: collapse the visual weight.** The Share trigger is currently a full-width cream button equal in size to the primary CTA — that's a hierarchy inversion. Make Share a **tertiary text+icon toggle** (left-aligned, like Help), above a hairline divider. When open, show the URL in a read-only inset field with the copy button inside it (the standard "copy field" pattern from Stripe/Vercel dashboards), not a separate cream strip.

---

## 7. Quick-win checklist (highest impact first)

1. **Add the spacing tokens** (§2) and replace all raw px.
2. **`.card { display:flex; flex-direction:column; gap:32px }`** + tighten within-section gaps to 16px (§3). *This alone fixes most of the "crowded."*
3. **Cut orange to two owners** (winner + focus); make Add a tonal/secondary button (§5).
4. **Demote Share** from full-width button to a tertiary toggle above a hairline divider (§6.4).
5. **Replace help/share toggles** with chevron text-buttons and animate via `grid-template-rows` (§6).
6. **Soften borders/shadow:** list rows `1px #ececec`, card gets layered shadow + hairline border (§3).
7. **Apply the type scale** (§5) so title/secondary/tertiary are clearly three tiers.

---

## Sources
- [IBM Carbon — Spacing](https://carbondesignsystem.com/elements/spacing/overview/) · [Carbon — 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)
- [Atlassian Design — Spacing](https://atlassian.design/foundations/spacing) · [Atlassian — Introducing the spacing scale](https://community.developer.atlassian.com/t/introducing-the-spacing-scale-the-beginnings-of-an-atlassian-spacing-system/65393)
- [Shopify Polaris — Spacing](https://legacy.polaris.shopify.com/design/spacing) · [Polaris — Using type](https://polaris.shopify.com/design/typography/using-type)
- [Material Design 3 — Spacing tokens](https://m3.material.io/styles/spacing/tokens) · [M3 — Density](https://m3.material.io/foundations/layout/grids-spacing/density) · [M3 — Cards](https://m3.material.io/components/cards/specs)
- [Four design principles behind Stripe, Linear, and Vercel](https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel) · [Vercel Design System Breakdown](https://seedflip.co/blog/vercel-design-system)
