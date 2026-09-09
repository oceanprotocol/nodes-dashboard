#!/usr/bin/env node
// Every preset URL must resolve, and every declared size must match the real one. A repack
// renaming a file is silent otherwise: the launch succeeds, the download 404s, and the user
// discovers it as a red loader node after paying.
//
// Reads the TypeScript table with a regex rather than importing it — this repo has no TS
// runner, and the table is a flat literal by design.
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/data/comfy-model-presets.ts', import.meta.url);
const text = readFileSync(SRC, 'utf8');

// Base URLs are factored into consts and interpolated as `${NAME}/path` — resolve them so the
// fetched URL matches what actually ends up in COMFY_MODEL_FILES.
const bases = Object.fromEntries([...text.matchAll(/const (\w+) = '([^']+)';/g)].map((m) => [m[1], m[2]]));

const files = [...text.matchAll(/url:\s*`\$\{(\w+)\}([^`]*)`[^}]*?gb:\s*([\d.]+)/gs)].map((m) => ({
  url: bases[m[1]] + m[2],
  gb: Number(m[3]),
}));

if (files.length === 0) {
  console.error('no preset files parsed — the table shape changed, fix this script');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const res = await fetch(file.url, { method: 'HEAD', redirect: 'follow' });
  if (!res.ok) {
    console.error(`MISSING ${res.status}  ${file.url}`);
    failed++;
    continue;
  }
  const actual = Number(res.headers.get('x-linked-size') ?? res.headers.get('content-length') ?? 0);
  const actualGb = actual / 1e9;
  // 5% tolerance: the table rounds to one decimal.
  if (actual > 0 && Math.abs(actualGb - file.gb) / file.gb > 0.05) {
    console.error(`SIZE  declared ${file.gb} GB, actual ${actualGb.toFixed(1)} GB  ${file.url}`);
    failed++;
  }
}

console.log(`${files.length - failed}/${files.length} preset files verified`);
process.exit(failed > 0 ? 1 : 0);
