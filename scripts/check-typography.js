#!/usr/bin/env node
/**
 * Flags text styles outside the type scale (theme/tokens.ts). Run with
 * `npm run check:type`; exits 1 if anything is off-scale.
 *
 * Allowed sizes are the scale's own; allowed weights are 400/600/700 (Bricolage
 * weights are baked into the font file, so they never take a fontWeight).
 */
const fs = require('fs');
const path = require('path');

const SIZES = new Set([10, 11, 12, 13, 14, 15, 16, 17, 20, 24, 28, 34]);
const WEIGHTS = new Set(['400', '600', '700', 'normal', 'bold']);
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
    for (const m of line.matchAll(/fontSize: ([0-9.]+)/g)) {
      if (!SIZES.has(Number(m[1]))) { console.log(`${file}:${i + 1}  off-scale fontSize ${m[1]}`); bad++; }
    }
    for (const m of line.matchAll(/fontWeight: '([0-9a-z]+)'/g)) {
      if (!WEIGHTS.has(m[1])) { console.log(`${file}:${i + 1}  off-scale fontWeight ${m[1]}`); bad++; }
    }
    if (/font\.(display|displayHeavy)/.test(line) && /fontWeight/.test(line)) {
      console.log(`${file}:${i + 1}  fontWeight on a Bricolage font (weight is baked in)`); bad++;
    }
    if (/className="[^"]*\b(text-(4xl|5xl|6xl)|font-(extrabold|black|thin|light))\b/.test(line)) {
      console.log(`${file}:${i + 1}  off-scale Tailwind text class`); bad++;
    }
  });
}
console.log(bad ? `\n${bad} typography issue(s)` : 'Typography scale: OK');
process.exit(bad ? 1 : 0);
