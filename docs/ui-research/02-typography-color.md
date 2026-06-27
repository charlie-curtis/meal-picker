# Typography & Color Systems — Meal Picker Redesign

**Dimension:** Typography and color systems
**Goal:** Move the single-card "Meal Picker" from a crowded, consumer-orange aesthetic to a calm, enterprise-professional look grounded in 2025 best practices.
**References studied:** IBM Carbon, Shopify Polaris, Material 3, Atlassian, plus modern-professional aesthetics (Linear, Stripe, Vercel).

---

## TL;DR

1. **Drop bright orange #ff6b35 as the global accent.** It reads consumer/food-delivery, not enterprise. Use a restrained indigo/blue primary (Stripe/Linear/Vercel/Carbon all converge here) and reserve a *muted* amber only for the "winner" celebration moment.
2. **Adopt a 16px base, Major-Third-ish type scale** on an Inter → system-font stack, with only 3 weights (400/500/600). Today the app mixes ad-hoc sizes (1.8rem, 1.1rem, 0.95rem, 0.9rem, 0.85rem, 0.82rem, 0.72rem) — collapse these to ~6 named steps.
3. **Build a full neutral ramp + semantic tokens** (text primary/secondary/tertiary, surface, border, etc.) so hierarchy comes from *neutral contrast*, not color. This is the single biggest lever for "less clutter."
4. **Everything passes WCAG AA** (4.5:1 text, 3:1 UI/borders). Several current values fail (see audit).

---

## 1. Current-state audit (what's hurting the "enterprise" read)

| Issue | Current | Why it's off |
|---|---|---|
| Accent | `#ff6b35` (saturated orange) used on input focus, chips hover, Add button, winner, result text, copy link | High-energy, food-delivery/consumer signal. Enterprise systems use desaturated blue/indigo and apply accent *sparingly*. |
| Type scale | 7+ unrelated sizes, only declared where needed | No system → inconsistent rhythm, contributes to "clunky." |
| Grays | Hard-coded one-offs: `#1a1a1a`, `#888`, `#aaa`, `#bbb`, `#ccc`, `#444`, `#666`, `#e5e5e5`, `#f0f0f0`, `#fafafa` | No ramp; some fail contrast (see §5). Random grays = visual noise. |
| Background | Warm cream `#f5f0eb` | Actually on-trend (2025 "warm neutral") — **keep it**, but pair with a true-neutral or warm-neutral ramp, not random cool grays. |
| Weights | 600/700 used for emphasis + bold | 700 everywhere is heavy; 500/600 reads more refined. |

**Verdict on #ff6b35:** Not enterprise. WebAIM check: `#ff6b35` on white ≈ **2.9:1** — it *fails* AA for the body-size "result" text and the copy-link button as currently used. It only barely works as a large/bold accent. Keep warmth in the *background*, not the action color.

---

## 2. Recommended font stack

Use **Inter** (the de-facto modern-professional UI typeface — Vercel, Linear-adjacent, GitHub Primer) with a robust system fallback so the app stays fast and renders well before the webfont loads.

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
             Roboto, Helvetica, Arial, sans-serif;
--font-mono: "SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace; /* for the share URL */
```

- Load Inter `400, 500, 600` only (3 weights → fast, cheap to license-free via Google Fonts/`@fontsource`). Enable `font-feature-settings: "cv11", "ss01";` for Inter's more legible single-story `a`/`g` if desired.
- Set `-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;` on `body`.
- **No-webfont fallback is fine:** the current `-apple-system` stack already looks professional; Inter just unifies cross-platform rendering.

**Learning summary — why Inter + system fallback?** Inter was designed specifically for UI at small sizes (tall x-height, open apertures), which is why Stripe/Vercel/Linear-style products favor it or close cousins. The system-font fallback (`-apple-system` etc.) means there's zero layout shift / blank text if the webfont is slow — a production-grade pattern. A *real* production app would self-host via `@fontsource/inter` (no Google CDN dependency, GDPR-friendly) rather than `<link>` to Google Fonts.

---

## 3. Type scale

Base **16px = 1rem**, ~1.2 (Minor Third) ratio, snapped to a 4px grid (Carbon/Material practice). Six named roles cover the whole card.

| Token | Use in app | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| `--text-display` | App title "Meal Picker" (`h1`) | **1.5rem / 24px** | 600 | 1.25 (30px) | -0.01em |
| `--text-heading` | Section labels if promoted, winner result | **1.125rem / 18px** | 600 | 1.35 | -0.005em |
| `--text-body` | Input, restaurant rows, buttons | **1rem / 16px** | 400 (500 on buttons) | 1.5 (24px) | 0 |
| `--text-body-sm` | Subtitle, share text, hints | **0.875rem / 14px** | 400 | 1.45 (20px) | 0 |
| `--text-label` | Category labels (uppercase), help toggle | **0.75rem / 12px** | 600 | 1.4 | 0.04em (tracking for uppercase) |
| `--text-caption` | Fine print / meta if needed | **0.6875rem / 11px** | 500 | 1.4 | 0.02em |

Notes:
- **Down-size the title.** `1.8rem` (29px) is shouty for a 460px card; `1.5rem` is plenty and reduces the "crowded" feeling instantly.
- Body text obeys the WCAG **1.5 line-height** guidance.
- Uppercase category labels need positive letter-spacing (`0.04em`) — required for legibility; the current `0.05em` is good, keep ~that.
- Only **3 weights** total (400 body, 500 buttons/captions, 600 titles/labels/emphasis). Replace every `font-weight: 700` with `600`.

---

## 4. Color system

### 4.1 Neutral ramp (the backbone)

A single 11-step **warm-neutral** ramp (slightly warm grays harmonize with the cream `#f5f0eb` background and feel less clinical than Carbon's cool grays — closer to Linear/Notion). Replace ALL the random one-off grays with these.

| Token | Hex | Role |
|---|---|---|
| `--neutral-0`  | `#ffffff` | Card surface |
| `--neutral-25` | `#faf8f5` | Subtle warm surface (row background) |
| `--neutral-50` | `#f5f0eb` | **Page background (keep the cream)** |
| `--neutral-100`| `#ece7e1` | Hover fill / chip background |
| `--neutral-200`| `#ddd6cd` | Borders, dividers |
| `--neutral-300`| `#c4bcb1` | Strong border / disabled border |
| `--neutral-400`| `#a39a8e` | Placeholder, tertiary text, × icon |
| `--neutral-500`| `#7d7468` | Secondary text (subtitle) |
| `--neutral-600`| `#5c5750` | Body secondary / icons |
| `--neutral-700`| `#403c37` | Strong text |
| `--neutral-900`| `#1f1d1a` | Primary text / dark "Pick" button |

### 4.2 Brand / accent

Replace orange with a **professional indigo-blue** primary (the enterprise convergence point: Carbon Blue, Stripe indigo, Vercel `#0070f3`, Linear indigo). Keep a *muted amber* purely as the celebratory winner color so the app keeps a little personality without shouting.

| Token | Hex | Use |
|---|---|---|
| `--primary-600` | `#4f46e5` | Primary action (Add button), focus ring base |
| `--primary-700` | `#4338ca` | Primary hover/active |
| `--primary-50`  | `#eef2ff` | Tinted hover / selected chip background |
| `--primary-100` | `#e0e7ff` | Subtle selected state |
| `--accent-amber-600` | `#b45309` | Winner text/border (warm, AA-safe — replaces #ff6b35 here) |
| `--accent-amber-50`  | `#fef3e2` | Winner row background fill |

> If you want to retain *some* warmth in the primary action (brand continuity with the cream), an alternative primary is a **terracotta/clay** `#c2410c` (700) / `#9a3412` (800) — still AA on white (≈4.8:1 / 6.4:1) and far more "premium" than `#ff6b35`. Indigo is the safer enterprise pick; clay keeps the food/warm personality. Pick one and use it consistently.

### 4.3 Semantic status

| Token | Hex | Contrast on white |
|---|---|---|
| `--success-600` | `#15803d` | 4.9:1 ✓ |
| `--success-50`  | `#f0fdf4` | fill |
| `--danger-600`  | `#dc2626` | 4.5:1 ✓ (remove-hover, errors) |
| `--danger-50`   | `#fef2f2` | fill |
| `--warning-600` | `#b45309` | 4.6:1 ✓ |

---

## 5. Light-theme semantic tokens

Map raw values → roles. Components reference *these*, never raw hex (Polaris/Carbon practice). This is what makes future theming and the rest of the redesign trivial.

```css
:root {
  /* Surfaces */
  --color-bg:            #f5f0eb;   /* page (warm) */
  --color-surface:       #ffffff;   /* card */
  --color-surface-subtle:#faf8f5;   /* restaurant rows, share box */
  --color-surface-hover: #ece7e1;   /* chip / row hover */

  /* Text — hierarchy via neutral contrast, not color */
  --color-text-primary:  #1f1d1a;   /* titles, row labels        ~15:1 */
  --color-text-secondary:#5c5750;   /* subtitle, body secondary  ~7:1  */
  --color-text-tertiary: #7d7468;   /* hints, meta               ~4.7:1 */
  --color-text-disabled: #a39a8e;   /* placeholder/disabled, large/UI only */
  --color-text-onPrimary:#ffffff;   /* text on indigo button     */
  --color-text-link:     #4338ca;   /* copy-link, inline links   */

  /* Borders */
  --color-border:        #ddd6cd;   /* default input/row border */
  --color-border-strong: #c4bcb1;   /* emphasis / hover border  */
  --color-border-focus:  #4f46e5;   /* focus                    */

  /* Interactive */
  --color-primary:       #4f46e5;
  --color-primary-hover: #4338ca;
  --color-primary-tint:  #eef2ff;   /* selected chip bg */

  /* Feedback */
  --color-success:       #15803d;
  --color-danger:        #dc2626;
  --color-winner-fg:     #b45309;
  --color-winner-bg:     #fef3e2;

  /* Focus ring (accessibility) */
  --focus-ring: 0 0 0 3px rgba(79, 70, 229, 0.35);
}
```

### Component remapping (concrete)

| Element | Was | Becomes |
|---|---|---|
| `h1` color | `#1a1a1a` | `--color-text-primary` `#1f1d1a` |
| `.subtitle` | `#888` (fails-ish at 14px → 3.5:1) | `--color-text-secondary` `#5c5750` |
| `.help-toggle` | `#aaa` (fails, 2.3:1) | `--color-text-link` `#4338ca` (or tertiary `#7d7468`) |
| `.help-category-label` | `#aaa` (fails) | `--color-text-secondary` `#5c5750` |
| `.help-chip` text/bg | `#444` on `#f5f0eb` | `--color-text-secondary` on `--color-surface-subtle` |
| `.help-chip:hover` | orange tint | `--color-primary-tint` bg + `--color-primary` text |
| input border / focus | `#e5e5e5` / orange | `--color-border` / `--color-border-focus` + `--focus-ring` |
| `.btn-add` | orange | `--color-primary`, hover `--color-primary-hover` |
| `.btn-pick` | `#1a1a1a` | keep dark → `--color-text-primary` (works as a strong neutral CTA) |
| row bg / border | `#fafafa` / `#f0f0f0` | `--color-surface-subtle` / `--color-border` |
| `.winner` | orange set | `--color-winner-bg` + `--color-winner-fg` + 600 weight |
| `.result` | orange (fails 2.9:1) | `--color-winner-fg` `#b45309` (4.6:1 ✓) |
| `.remove-btn` | `#ccc` → `#e53e3e` | `--color-text-disabled` → `--color-danger` |
| `.empty-hint` | `#bbb` (fails, 1.9:1) | `--color-text-tertiary` `#7d7468` (4.7:1 ✓) |
| `.btn-copy` | orange | `--color-text-link` `#4338ca` |

---

## 6. Accessibility (WCAG 2.2 AA)

Targets: **4.5:1** normal text, **3:1** large text (≥24px or ≥18.66px bold) and **UI components/borders**.

**Failures in the current build that this palette fixes:**
- `#aaa` text on white ≈ **2.3:1** (help toggle, category labels) → fail.
- `#bbb` on white ≈ **1.9:1** (empty hint) → fail.
- `#888` at 14px ≈ **3.5:1** (subtitle) → fail for normal text.
- `#ccc` × icon ≈ **1.6:1** → fails the 3:1 UI-component rule.
- `#ff6b35` on white ≈ **2.9:1** → fails as body-size "result"/copy-link text.

**Built into the new tokens:**
- All text tokens meet ≥4.5:1 on their intended surfaces (tertiary `#7d7468` = 4.7:1 is the floor and is only used for hints/placeholders).
- Borders use `#ddd6cd` (~1.3:1 — *decorative* dividers are exempt) but **focus and input borders** that convey state use `#c4bcb1`/primary to clear 3:1.
- **Visible focus ring** (`--focus-ring`) on every interactive element — don't rely on `border-color` change alone (WCAG 2.4.7 / 2.4.11).
- Winner state must not be conveyed by **color alone** (WCAG 1.4.1): keep the 600 weight + a small label/icon (e.g. a checkmark or "Winner") so colorblind users perceive it.
- Don't reduce link/toggle affordance to color only — keep the underline on the help toggle, or add an icon.

---

## 7. Using color to establish hierarchy without clutter

The core fix for "crowded and clunky" is **less color, more neutral contrast**:

1. **One accent, used rarely.** Indigo appears only on: the primary Add button, focus states, selected chips, and inline links. That's it. (Stripe/Vercel rule: color = meaning, not decoration.)
2. **Hierarchy via the neutral ramp.** Title → primary `#1f1d1a`, secondary → `#5c5750`, meta → `#7d7468`. Three steps of gray do the work that competing colors were doing.
3. **Surfaces, not borders, for grouping.** Lean on `--color-surface-subtle` fills + generous spacing instead of 2px borders everywhere. Drop the heavy `2px` borders to `1px` `--color-border`; the visual weight reduction alone declutters the card.
4. **Reserve saturation for moments.** The amber winner highlight is the *only* warm, saturated moment — which makes the "Pick one" payoff feel special precisely because nothing else competes with it.
5. **Tints over solids for soft states.** Hover/selected = `--color-primary-tint` (`#eef2ff`) rather than full-saturation fills; lighter touch, less noise.

---

## 8. Learning summary (vibecoding)

- **Design tokens** = named variables (`--color-text-secondary`) that sit between raw hex and components. Polaris and Carbon both ship *only* tokens to product teams, never raw hex, because you can re-skin or add dark mode by swapping one layer. Industry standard tooling: **Style Dictionary** (Amazon) or **Tokens Studio** for Figma → exports the same tokens to CSS/iOS/Android. For this small app, plain CSS custom properties (above) are the right, no-over-engineering choice; you'd reach for Style Dictionary only when multiple platforms/themes appear.
- **Type scale ratios:** a "scale" multiplies a base size by a fixed ratio (1.2 Minor Third here) so sizes relate harmonically instead of being chosen ad hoc — the same reason musical intervals sound consonant. Enterprise systems then *snap to a 4px grid* so type aligns with spacing.
- **Why Inter and not a brand serif/display font:** UI typefaces optimize for small-size legibility (x-height, aperture, hinting). A display font would look "designed" but read worse at 12–14px — wrong tradeoff for a dense tool. Production teams self-host via `@fontsource` rather than Google Fonts CDN for privacy/perf.
- **Contrast math:** WCAG ratios come from relative luminance, not perceived brightness — which is why a bright orange can *look* bold yet *fail* (2.9:1). Always check with WebAIM's contrast checker rather than eyeballing.

---

### Sources
- [Stripe / Linear / Vercel premium UI breakdown — Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)
- [Vercel design system: colors, typography, tokens — SeedFlip](https://seedflip.co/blog/vercel-design-system)
- [Color tokens — Shopify Polaris](https://polaris-react.shopify.com/design/colors/color-tokens)
- [Palettes and roles — Shopify Polaris](https://polaris-react.shopify.com/design/colors/palettes-and-roles)
- [Color guide — IBM Carbon Design System](https://github.com/carbon-design-system/carbon/blob/main/docs/guides/colors.md)
- [Typography in Design Systems — Nathan Curtis / EightShapes](https://medium.com/eightshapes-llc/typography-in-design-systems-6ed771432f1e)
- [Mastering typography with semantic tokens & responsive scaling — UX Collective](https://uxdesign.cc/mastering-typography-in-design-systems-with-semantic-tokens-and-responsive-scaling-6ccd598d9f21)
- [UI Font Size Guidelines — b13](https://b13.com/blog/designing-with-type-a-guide-to-ui-font-size-guidelines)
- [WebAIM: Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [Understanding SC 1.4.3 Contrast (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WCAG 2.2 Contrast Ratio Explained — Accessibility Assistant](https://accessibilityassistant.com/blog/accessibility-insights/how-to-apply-wcag-22-colour-contrast-accessibility/)
</content>
</invoke>
