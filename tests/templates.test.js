import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name));

test('both ProPresenter master templates are present and contain their expected sample text', async () => {
  const bible = await read('templates/Template_MUC-Bibelvers.pro');
  const points = await read('templates/Template_Stichpunkte.pro');
  assert.ok(bible.length > 1000, 'Bible template should be a non-empty native .pro file');
  assert.ok(points.length > 1000, 'Point template should be a non-empty native .pro file');
  assert.ok(bible.includes(Buffer.from('Bibelstelle')), 'Bible template should contain its reference field');
  assert.ok(points.includes(Buffer.from('Punkt 1')), 'Point template should contain the sample point text');
});

test('both corresponding theme files are present', async () => {
  const bible = await read('themes/Theme_MUC-Bibelvers.protheme');
  const points = await read('themes/Theme_Stichpunkte.protheme');
  assert.ok(bible.length > 0);
  assert.ok(points.length > 0);
});

test('Bible and quote preview use calibrated PP7 master-slide positions and sizing', async () => {
  const css = (await read('src/style.css')).toString();
  assert.match(css, /top:\s*10\.8%/);
  assert.match(css, /left:\s*5\.2%/);
  assert.match(css, /font-size:\s*clamp\(15px,\s*3cqi,\s*50px\)/);
  assert.match(css, /top:\s*58\.2%/);
  assert.match(css, /right:\s*5\.5%/);
  assert.match(css, /text-align:\s*right/);
});

test('app is renamed and the single-slide test download is removed', async () => {
  const main = (await read('src/main.js')).toString();
  const html = (await read('index.html')).toString();
  assert.match(main, /<h1>PP7 file creator<\/h1>/);
  assert.doesNotMatch(main, /export-test-slide|Einzelfolie testen|Sermon-file Creator for PP7/);
  assert.match(html, /<title>PP7 file creator<\/title>/);
});
