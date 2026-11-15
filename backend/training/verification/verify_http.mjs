// Verify the actual local response and downloadable bytes, not browser interactions.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dataset = path.join(root, 'backend/training/datasets/pmma-v1');
const response = await fetch('http://127.0.0.1:3000/training', { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200);
assert.equal(new URL(response.url).pathname, '/training');
const html = await response.text();
const chartTitles = [...html.matchAll(/<circle\b[^>]*><title>([^<]*)<\/title><\/circle>/g)].map(match => match[1]);
assert.equal(chartTitles.length, 103, 'Expected all 34 prediction and 69 source chart tooltips in server HTML');
assert.ok(chartTitles.includes('S1-R-10: observed 0.0715, predicted 0.0660 mm/s'));
assert.ok(chartTitles.every(title => title.length > 0), 'SVG tooltip text must survive server rendering');
for (const text of ['Measurements, models and their limits.', 'The tested bridge fails transfer. A subset needs investigation.', '3.52330', 'Round 3 model', 'Round 3 evaluation', 'Better within-domain estimates. Transfer remains unresolved.', 'First training and verification complete', '0.01049', 'Round 2 model', 'S1-L-01', 'candidate_training.csv', 'Decisions you can challenge', 'Lunar reference, kept separate']) {
  assert.ok(html.includes(text), `Missing rendered content: ${text}`);
}
const snapshot = JSON.parse(await readFile(path.join(root, 'web/src/data/training-v1.json'), 'utf8'));
const checked = [];
for (const entry of snapshot.downloads) {
  const res = await fetch(`http://127.0.0.1:3000/training/pmma-v1/${entry.name}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(res.status, 200);
  const actual = Buffer.from(await res.arrayBuffer());
  const expected = await readFile(path.join(dataset, entry.name));
  assert.deepEqual(actual, expected, `Download mismatch: ${entry.name}`);
  const sha256 = createHash('sha256').update(actual).digest('hex');
  assert.equal(sha256, entry.sha256);
  checked.push({ name: entry.name, sha256, bytes: actual.length });
}
const result = {
  passed: true, checked_route: '/training', page_status: response.status,
  nonempty_server_chart_titles: chartTitles.length,
  checked_downloads: checked, browser_interaction_verified: false,
  browser_limitation: 'Local browser use disabled in Work settings. HTTP rendering/downloads checked; user to review filters and visual layout.',
};
for (const roundName of ['round1', 'round2', 'round3']) {
const round = JSON.parse(await readFile(path.join(root, `web/src/data/training-${roundName}.json`), 'utf8'));
for (const entry of round.downloads) {
  const res = await fetch(`http://127.0.0.1:3000/training/${roundName}/${entry.name}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(res.status, 200);
  const actual = Buffer.from(await res.arrayBuffer());
  const expected = await readFile(entry.source ? path.join(root, entry.source) : path.join(root, `backend/training/runs/${roundName}-2026-11-14`, entry.name));
  assert.deepEqual(actual, expected);
  const sha256 = createHash('sha256').update(actual).digest('hex');
  assert.equal(sha256, entry.sha256);
  checked.push({ name: `${roundName}/${entry.name}`, sha256, bytes: actual.length });
}
}
await writeFile(path.join(root, 'backend/training/reports/web-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

