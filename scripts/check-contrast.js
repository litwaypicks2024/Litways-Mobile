#!/usr/bin/env node
/**
 * Guards text readability: every text colour in theme/tokens.ts must meet
 * WCAG AA (4.5:1) on the surfaces it is actually drawn on — white cards AND
 * the grey canvas (#ececec), which is where product captions sit.
 * Run via `npm run check:type`.
 */
const fs = require('fs');

const src = fs.readFileSync('theme/tokens.ts', 'utf8');
const hex = (name) => {
  const m = src.match(new RegExp(`\\b${name}:\\s*'(#[0-9a-fA-F]{6})'`));
  if (!m) throw new Error(`token ${name} not found (or not a hex literal)`);
  return m[1];
};

const lum = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = { white: '#ffffff', canvas: hex('bg') };
// [token, minimum, surfaces it must pass on]
const rules = [
  ['ink', 4.5, ['white', 'canvas']],
  ['inkBody', 4.5, ['white', 'canvas']],
  ['inkMuted', 4.5, ['white', 'canvas']],
  ['accentText', 4.5, ['white', 'canvas']],
  ['danger', 4.5, ['white']],
  ['inkFaint', 4.5, ['white']], // placeholders live inside white fields
];

let bad = 0;
// White text sits on the accent FILL (buttons, badges, active chips).
for (const token of ['accentFill']) {
  const r = ratio('#ffffff', hex(token));
  if (r < 4.5) { console.log(`white on ${token}: ${r.toFixed(2)}:1 (needs 4.5:1)`); bad++; }
}
for (const [token, min, on] of rules) {
  for (const s of on) {
    const r = ratio(hex(token), surfaces[s]);
    if (r < min) { console.log(`${token} on ${s}: ${r.toFixed(2)}:1 (needs ${min}:1)`); bad++; }
  }
}
console.log(bad ? `\n${bad} contrast issue(s)` : 'Contrast: OK');
process.exit(bad ? 1 : 0);
