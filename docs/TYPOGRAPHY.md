# Typography

Source of truth: the `type` scale in `theme/tokens.ts`. Render text with `<Text variant="…">` from `components/ui/Text.tsx`. `npm run check:type` flags anything off-scale.

## Fonts
- **Inter (primary)** — all UI text, prices, buttons. Loaded as Regular 400, Medium 500, SemiBold 600, Bold 700.
- **Merriweather (secondary)** — editorial headings only: hero, display, title. Loaded as Bold 700.
- Both are static font files, so **weight is a font family** (`Inter_600SemiBold`), not `fontWeight` — Android ignores `fontWeight` on custom fonts. A role picks its weight itself; a nested span changes weight with `<Text weight="medium" | "semibold" | "bold">`.
- The logo lockup (`LogoMark`) keeps Bricolage Grotesque: the wordmark is artwork, not UI type.
- Fonts load with `useFonts` in `app/_layout.tsx`; the splash holds until they are ready.

## Readability (what each level is for)
| Level | Job | Rule |
|---|---|---|
| Headings (hero, display, title) | Carry the brand, stop the eye | Merriweather Bold, 20+ px, `ink`. Few per screen. |
| Primary content (product names, prices, totals, buttons) | What the shopper acts on | Inter 600–700, 14–16 px, `ink`; price in `accent`. Never truncated to one line if it can wrap to two. |
| Secondary text (brand, ratings, meta, helper) | Support the primary | Inter 500+, **12–13 px minimum**, `inkMuted` or `inkBody`. Never lighter or smaller than this. |
| Labels / badges | Tiny UI furniture | 11 px, 600–700. Only for tab labels, badges, chips. |
| Placeholders, decorative icons | Hint, not content | `inkFaint` only. |

Hard limits (enforced by `npm run check:type`):
- **Contrast ≥ 4.5:1 on the surface the text is actually on** — white cards *and* the `#ececec` canvas (product captions sit on the canvas). `inkMuted` is `#5f5f5f` (5.4:1 canvas); `inkFaint` is not for content.
- **Orange as text** uses `accentText` (`#b93a08`, 4.8:1), via `tone="accent"`. The bright `accent` (`#ea580c`, 3.0:1 on canvas) is for fills, icons and rings only.
- **Small text is Medium (500) or heavier**; Regular is for 14 px and up. Thin small grey text is what reads as "scribbled in".
- **Size floor:** nothing below 11 px; content below 12 px is not allowed.

## Rules
1. Sixteen roles, no other sizes (below), each with a fixed line height.
2. No `fontWeight` anywhere (except splash artwork, which renders before fonts load). Use a variant, or `<Text weight>` on a nested span.
3. No half-pixel sizes.
4. Letter-spacing only on hero/display/title/heading/priceLg (slightly negative) and overline (+0.8).
5. One styling system: `<Text variant>`. NativeWind `text-*` sizes on `<Text>` are rejected by the check script.
6. Every `TextInput` sets `fontFamily: font.sans` (it does not inherit).
7. Colour: `ink` headings/primary, `inkBody` paragraphs, `inkMuted` secondary, `inkFaint` placeholders/decoration only.
8. Prices and totals use tabular numerals so columns and totals don't jitter.
9. OS font scaling stays on; large/tight roles are capped (see `SCALE_CAP` in `Text.tsx`).

## Scale
| Role | Size / line | Font | Use |
|---|---|---|---|
| hero | 32 / 42 | Merriweather 700 | Home greeting, auth header |
| display | 26 / 34 | Merriweather 700 | Page titles |
| title | 20 / 28 | Merriweather 700 | Section/screen headings, dialog and empty-state titles |
| heading | 17 / 22 | Inter 700 | Card, sheet, compact-rail titles |
| priceLg | 24 / 30 | Inter 700 | Order totals |
| price | 16 / 20 | Inter 700 | Prices |
| bodyLg | 15 / 22 | Inter 400 | Descriptions, dialog messages |
| body / bodyStrong | 14 / 20 | Inter 400 / 600 | Default UI text, inputs, rows |
| small | 13 / 18 | Inter 600 | Product names, chips, secondary lines |
| caption | 13 / 18 | Inter 500 | Plain secondary sentences |
| meta | 12 / 16 | Inter 500 | Counts, dates, helper and error text |
| metaStrong | 12 / 16 | Inter 600 | Chips, badges, emphasised counts |
| label | 11 / 14 | Inter 600 | Field labels, tab labels, captions |
| overline | 11 / 14 | Inter 700, caps | Badges, eyebrows |
| button | 15 / 20 | Inter 700 | Button labels (13 / 15 / 16 by size) |

## Exceptions
- **Nested spans** inside a sentence may set only colour (`tone`) and `weight`; size is inherited from the parent.
- **Brand artwork** — the logo lockup and the splash — sizes its type to the artwork, not the scale.
