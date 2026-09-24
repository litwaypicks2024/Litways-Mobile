# Typography

Source of truth: the `type` scale in `theme/tokens.ts`. Render text with `<Text variant="…">` from `components/ui/Text.tsx`. `npm run check:type` flags anything off-scale.

## Rules
1. **Two fonts.** Bricolage Grotesque for headings, prices and totals; the system font for everything else. Bricolage weight is baked into the font file — never add `fontWeight` to it.
2. **Sixteen roles, no other sizes** (below). Each has a fixed line height.
3. **System-font weights: 400 / 600 / 700 only.** No 500, 800 or 900.
4. **No half-pixel sizes.**
5. **Letter-spacing** only on hero/display/title/heading (negative) and overline (+0.8).
6. **One styling system.** Use `<Text variant>`. Inline `fontSize` is allowed only at scale sizes; NativeWind `text-*` classes are snapped to the scale in `tailwind.config.js`.
7. **Colour:** `ink` headings/primary, `inkBody` paragraphs, `inkMuted` secondary, `inkFaint` placeholders/decoration only.
8. **Accessibility:** OS font scaling stays on; tight/large roles are capped (see `SCALE_CAP` in `Text.tsx`).

## Scale
| Role | Size / line | Font · weight | Use |
|---|---|---|---|
| hero | 34 / 40 | Bricolage 800 | Home greeting, splash, auth header |
| display | 28 / 34 | Bricolage 800 | Page titles |
| title | 20 / 26 | Bricolage 700 | Section/screen headings, dialog and empty-state titles |
| heading | 17 / 22 | Bricolage 700 | Card, sheet, compact-rail titles |
| priceLg | 24 / 30 | Bricolage 800 | Order totals |
| price | 16 / 20 | Bricolage 800 | Prices |
| bodyLg | 15 / 22 | System 400 | Descriptions, dialog messages |
| body / bodyStrong | 14 / 20 | System 400 / 600 | Default UI text, inputs, rows |
| small | 13 / 18 | System 600 | Product names, chips, secondary lines |
| caption | 13 / 18 | System 400 | Plain secondary sentences |
| meta | 12 / 16 | System 400 | Counts, dates, helper and error text |
| metaStrong | 12 / 16 | System 600 | Chips, badges, emphasised counts |
| label | 11 / 14 | System 600 | Field labels, tab labels, captions |
| overline | 10 / 12 | System 700, caps | Badges, eyebrows |
| button | 15 / 20 | System 700 | Button labels (13 / 15 / 16 by size) |

## Exceptions
- **Nested spans** inside a sentence (a bold word, a tappable link) may set only weight and colour, and inherit size from the parent.
- **Brand artwork** — the logo lockup (`components/brand/LogoMark.tsx`) and the splash (`components/BrandSplash.tsx`) — sizes its type to the artwork, not the scale.
