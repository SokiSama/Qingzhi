import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = pathToFileURL(path.join(root, 'tests/fixture.html')).href;
const popupHtml = fs.readFileSync(path.join(root, 'extension/popup.html'), 'utf8')
  .replace('href="popup.css"', 'href="../extension/popup.css"')
  .replace('<script src="settings.js" defer>', '<script src="mock-chrome.js"></script><script src="../extension/settings.js" defer>')
  .replace('src="popup.js"', 'src="../extension/popup.js"')
  .replace('src="icons/', 'src="../extension/icons/')
  .replace('</head>', '<script src="popup-test.js" defer></script></head>');
fs.writeFileSync(path.join(root, 'tests/popup-fixture.html'), popupHtml);
for (const test of [{ width: 1920, url }, { width: 1280, url }, { width: 600, url },
  { width: 1280, url: `${url}?stored-image-less=1` },
  { width: 400, url: pathToFileURL(path.join(root, 'tests/popup-fixture.html')).href }]) {
  const { width } = test;
  const args = [
    '--headless', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${path.join(root, 'tests/.chrome-test-profile')}`,
    '--allow-file-access-from-files', '--dump-dom', '--virtual-time-budget=10000',
    `--window-size=${width},1080`, test.url
  ];
  if (width === 1920) args.splice(-1, 0, `--screenshot=${path.join(root, 'tests/preview.png')}`);
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
  fs.writeFileSync(path.join(root, `tests/browser-result-${width}.html`), result.stdout || '');
  const output = result.stdout || '';
  const report = output.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
  console.log(`${width}px: ${result.error?.message || `Chrome exit ${result.status}`}`);
  console.log(report || result.stderr?.slice(-2000) || 'No browser test output');
  if (result.status !== 0 || !/<body\b[^>]*\bdata-test-status="passed"[^>]*>/.test(output)) process.exitCode = 1;
}
