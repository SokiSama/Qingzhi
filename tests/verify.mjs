import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.name, '轻知');
assert.equal(manifest.description, '无所不知，知你所想');
assert.equal(manifest.action.default_title, '轻知');
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = fs.readFileSync(path.join(dir, file));
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
  assert.equal(manifest.action.default_icon[size], file);
}
for (const script of manifest.content_scripts) {
  assert.equal(script.run_at, 'document_start');
  for (const file of [...script.js, ...script.css]) assert.ok(fs.existsSync(path.join(dir, file)), file);
  assert.ok(script.matches.every(pattern => /^https:\/\/(www\.|zhuanlan\.)?zhihu\.com\/\*$/.test(pattern)));
}
for (const file of ['settings.js', 'content.js', 'popup.js']) {
  new vm.Script(fs.readFileSync(path.join(dir, file), 'utf8'), { filename: file });
}
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(dir, 'settings.js'), 'utf8'), context);
const settings = context.CleanZhihuSettings;
assert.equal(settings.normalize().width, 1440);
assert.equal(settings.normalize({ width: 0 }).width, 0);
assert.equal(settings.normalize({ width: 99999 }).width, 1920);
assert.equal(settings.normalize({ width: -5 }).width, 960);
assert.equal(settings.normalize({ width: NaN }).width, 1440);
assert.equal(settings.normalize({ enabled: 'false' }).enabled, true);
assert.equal(settings.normalize({ enabled: false }).enabled, false);
const popup = fs.readFileSync(path.join(dir, 'popup.html'), 'utf8');
assert.ok(!/on(?:click|change|input)=|<script[^>]*>\s*[^<\s]/i.test(popup), 'MV3 popup has no inline scripts');
for (const file of ['popup.css', 'popup.js', 'popup.html']) assert.ok(fs.existsSync(path.join(dir, file)));
console.log('PASS manifest, file references, script syntax, settings validation and popup CSP checks');
console.log('Browser regression page: http://127.0.0.1:8765/tests/fixture.html');
