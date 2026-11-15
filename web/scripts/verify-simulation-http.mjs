// Regression check: a 200 response alone missed stripped CSS Module exports.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rankStudies } from '../src/lib/investigation-ranking.ts';
import catalog from '../src/data/investigations.json' with { type: 'json' };
const questionLeaders = { prevention: 'pmma', detection: 'same', suppression: 'flex', 'partial-gravity': 'luci' };
for (const [topic, expected] of Object.entries(questionLeaders)) {
  const ranked = rankStudies(catalog.entries, topic);
  assert.equal(ranked[0].id, expected, topic);
  assert.equal(new Set(ranked.map(s => s.id)).size, 6);
  if (topic === 'detection') assert.equal(ranked[1].id, 'daft');
}
const origin = 'http://127.0.0.1:3000';
const get = async (url) => {
  const response = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
  return { response, body: await response.text() };
};
const { response, body: html } = await get('/');
assert.equal(new URL(response.url).pathname, '/dashboard');
assert.ok(html.includes('Real experiments. Visible evidence.'));
assert.ok(html.includes('id="finder-title"'));
assert.ok(html.includes('Research relevance order'));
assert.ok(html.includes('Compare with'));
assert.ok(html.includes('SAME / SAME-R'));
assert.ok(html.includes('How well does Earth training transfer to the ISS?'));
assert.ok(html.includes('0.02644') && html.includes('0.01049'));
assert.ok(html.includes('Inspect burn'));
const simulation = await get('/simulation');
assert.ok(simulation.body.includes('PMMA rod lab'));
const pmmaSections = ['aria-label="Simulation experiment"', 'Environment-wide evaluation scores', '0.01333', '0.18250', 'PMMA rod lab', 'aria-label="PMMA workspace views"', 'aria-label="Export comparison"', 'id="conditions-heading"', 'data-pmma-results', 'aria-label="Playback time"', 'id="insights-heading"'];
assert.ok(!simulation.body.includes('PUBLISHED CONDITIONS'));
let previous = -1;
for (const section of pmmaSections) {
  const index = simulation.body.indexOf(section);
  assert.ok(index > previous, `Missing or misplaced PMMA section: ${section}`);
  previous = index;
}
assert.ok(simulation.body.includes('Simulation experiment'));
const analytics = await get('/analytics');
assert.equal(new URL(analytics.response.url).pathname, '/training');
assert.ok(!html.includes('Ask NASA INDUS'));
assert.ok(!html.includes('Expo Crew Link'));
assert.ok(!html.includes('SYNCED'));
assert.ok(!html.includes('NASA FM2 Lunar Lander'));
const appClass = html.match(/<div class="([^"]+)" data-theme="dark">/)?.[1];
assert.ok(appClass, 'Simulation root must have a CSS Module class');
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1]);
const css = (await Promise.all(styles.map(async url => (await get(url)).body))).join('\n');
assert.ok(appClass.split(' ').every(name => css.includes(`.${name}`)), 'Exported root class must have served CSS');
assert.ok(css.includes('[data-theme="light"]'), 'Light theme styles must be served');
assert.ok(!css.includes(':global('), 'CSS Module global selector must be compiled');
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]))];
await Promise.all(scripts.map(get));
const training = await get('/training');
assert.ok(training.body.includes('Measurements, models and their limits.'));
assert.ok(training.body.includes('Curved flow helps pooling. Separate models still win.'));
const flex = await get('/simulation/flex');
assert.equal(new URL(flex.response.url).pathname, '/simulation');
assert.equal(new URL(flex.response.url).searchParams.get('experiment'), 'flex');
assert.ok(flex.body.includes('Simulation experiment'));
assert.ok(!flex.body.includes('aria-label="Environment-wide evaluation scores"'));
for (const view of [html, simulation.body, flex.body, training.body]) {
  assert.ok(view.includes('data-theme="dark"'));
  assert.doesNotMatch(view, /Published observations · Saved model results|PYROGRAV \/ NASA SPACE APPS PROJECT|No live telemetry/i);
  assert.equal((view.match(/aria-label="Main navigation"/g)||[]).length, 1);
  assert.equal((view.match(/id="workspace"/g)||[]).length, 1);
  assert.equal((view.match(/Switch to light mode/g)||[]).length, 1);
  assert.ok(!view.includes('NEXT_HTTP_ERROR_FALLBACK;500'));
}
assert.ok(training.body.includes('Source-matched droplet rates'));
assert.ok(flex.body.includes('FLEX droplet lab'));
assert.ok(flex.body.includes('FLEX workspace views'));
assert.ok(flex.body.includes('flex-panel-compare'));
assert.match(flex.body, /id="flex-panel-performance"[^>]+hidden/);
assert.match(flex.body, /id="flex-panel-source"[^>]+hidden/);
assert.ok(flex.body.includes('Space guide'));
assert.ok(flex.body.includes('AI not connected'));
assert.ok(flex.body.includes('Workspace sidebar'));
assert.ok(!/mmÂ|â‚/.test(flex.body));
assert.ok(flex.body.includes('0.05371'));
assert.ok(flex.body.includes('Eligible measurements'));
assert.ok(flex.body.includes('0.05371'));
assert.ok(flex.body.includes('not a measured time history or an extinction forecast'));
const flexClass = flex.body.match(/<div class="([^"]+)" data-theme="dark">/)?.[1];
assert.equal(flexClass, appClass);
const flexScripts = [...new Set([...flex.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))];
await Promise.all(flexScripts.map(get));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let downloads = 0;
for (const [folder, run, names] of [
  ['round4','round4-2026-11-14',['results.json','protocol.json','metrics.csv','heldout_predictions.csv']],
  ['flex-v1','flex-round1-2026-11-14',['results.json','protocol.json','metrics.csv','predictions.csv']],
]) {
  for (const name of names) {
    const served = await get(`/training/${folder}/${name}`);
    const expected = await readFile(path.join(root,'backend/training/runs',run,name),'utf8');
    assert.equal(served.body, expected, `${folder}/${name} must match frozen run`);
    downloads++;
  }
}
for (const name of ['candidate_training.csv','review_queue.csv','data.json']) {
  assert.equal((await get(`/training/flex-v1/${name}`)).body, await readFile(path.join(root,'backend/training/datasets/flex-v1',name),'utf8'));
  downloads++;
}
const results = JSON.parse((await get('/training/physics-baseline/results.json')).body);
assert.ok(results);
const verification = { passed: true, root_redirect: '/dashboard', scoped_root_class: appClass, stylesheets: styles.length, scripts: scripts.length, flex_scripts: flexScripts.length, matched_downloads: downloads, evidence_page: 200, flex_page: 200, physics_results: 200, browser_interaction_verified: false };
await writeFile(path.join(root,'docs/challenge-workbench-2026-11-14/web-verification.json'),JSON.stringify({...verification, question_leaders: questionLeaders, pmma_section_order: pmmaSections, legacy_footer_removed: true},null,2)+'\n');
console.log(JSON.stringify(verification, null, 2));
