#!/usr/bin/env node
/**
 * Flags text styles outside the type scale (theme/tokens.ts). Run with
 * `npm run check:type`; exits 1 if anything is off-scale.
 *
 * Allowed sizes are the scale's own. Inter and Merriweather are static files, so
 * weight comes from fontFamily (a role, or <Text weight>) — never fontWeight,
 * which Android ignores on custom fonts.
 */
const fs = require('fs');
const path = require('path');

const SIZES = new Set([10, 11, 12, 13, 14, 15, 16, 17, 20, 24, 26, 32]);
// Artwork that renders before the fonts load (splash) may use system weights.
const WEIGHT_EXEMPT = ['components/BrandSplash.tsx'];
const ROOTS = ['app', 'components'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

let bad = 0;
for (const file of ROOTS.flatMap((r) => walk(r))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return; // comments
    for (const m of line.matchAll(/fontSize: ([0-9.]+)/g)) {
      if (!SIZES.has(Number(m[1]))) { console.log(`${file}:${i + 1}  off-scale fontSize ${m[1]}`); bad++; }
    }
    if (/fontWeight/.test(line) && !WEIGHT_EXEMPT.some((f) => file.endsWith(f))) {
      console.log(`${file}:${i + 1}  fontWeight — use a variant or <Text weight>`); bad++;
    }
    if (/className="[^"]*\b(text-(4xl|5xl|6xl)|font-(bold|semibold|medium|extrabold|black|thin|light))\b/.test(line)) {
      console.log(`${file}:${i + 1}  off-scale Tailwind text class`); bad++;
    }
    if (/<Text\b[^>]*className="[^"]*\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/.test(line)) {
      console.log(`${file}:${i + 1}  Tailwind text size on <Text> — use <Text variant>`); bad++;
    }
  });
}
console.log(bad ? `\n${bad} typography issue(s)` : 'Typography scale: OK');
process.exit(bad ? 1 : 0);
