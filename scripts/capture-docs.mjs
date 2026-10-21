import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = path.join(root, 'tests/docs-preview');
const images = path.join(root, 'docs/images');
fs.mkdirSync(temp, { recursive: true });
fs.mkdirSync(images, { recursive: true });
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const popup = fs.readFileSync(path.join(root, 'extension/popup.html'), 'utf8')
  .replace('href="popup.css"', 'href="../../extension/popup.css"')
  .replace('src="settings.js"', 'src="../../extension/settings.js"')
  .replace('src="popup.js"', 'src="../../extension/popup.js"')
  .replace('src="icons/', 'src="../../extension/icons/')
  .replace('</head>', '<script src="../mock-chrome.js"></script><style>body{margin:24px auto;border:1px solid #e7ebf2;border-radius:18px;box-shadow:0 8px 30px #22314a12}</style></head>');
fs.writeFileSync(path.join(temp, 'settings.html'), popup);
// Reading screenshots are user-supplied originals; never overwrite them here.
for (const [name, size] of [['settings', '500,720']]) {
  const output = path.join(images, `${name}.png`);
  const run = spawnSync(chrome, [
    '--headless', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--force-prefers-reduced-motion',
    `--user-data-dir=${path.join(root, 'tests/.chrome-test-profile')}`,
    '--allow-file-access-from-files', '--virtual-time-budget=1500',
    `--window-size=${size}`, `--screenshot=${output}`,
    pathToFileURL(path.join(temp, `${name}.html`)).href
  ], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
  if (run.status !== 0 || !fs.existsSync(output)) throw new Error(run.error?.message || run.stderr || `Screenshot failed: ${name}`);
  console.log(`Saved docs/images/${name}.png`);
}
