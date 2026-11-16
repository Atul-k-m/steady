// Build the static web deploy: node tools/build-web.mjs  →  dist/web/
// Copies app/ without the extension-only files and adds _headers (read by Netlify and Cloudflare Pages).
// Also zips app/ (the unpacked extension) into dist/web/downloads/steady-extension.zip for get.html. No npm dependencies.
// _headers can't live in app/: Chrome refuses to load an unpacked extension containing files that start with "_".
import { cpSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const OUT = join(ROOT, 'dist', 'web');
const EXTENSION_ONLY = new Set(['manifest.json', 'js/bridge.js', 'js/sw.js', 'js/site-bridge.js', 'options.html', 'js/options.js']);
// The public origin, used in canonical URLs, Open Graph images, sitemap.xml, robots.txt and llms.txt (token __SITE__).
const SITE = (process.env.SITE_URL || 'https://steady-helper-alpha.vercel.app').replace(/\/$/, '');

// Keep in step with the <meta http-equiv="Content-Security-Policy"> in each page. Headers add frame-ancestors,
// which a meta tag cannot set. 'self' framing is needed by demo.html, which shows book.html / week.html side by side.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const HEADERS = `/*
  Content-Security-Policy: ${CSP}
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
`;

// Keep the Vercel project link (dist/web/.vercel) across builds; wipe everything else.
if (existsSync(OUT)) for (const e of readdirSync(OUT)) if (e !== '.vercel') rmSync(join(OUT, e), { recursive: true, force: true });
cpSync(APP, OUT, {
  recursive: true,
  filter: (src) => !EXTENSION_ONLY.has(relative(APP, src).split(sep).join('/')),
});
writeFileSync(join(OUT, '_headers'), HEADERS);
// Put the real origin into the public files.
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
for (const f of walk(OUT).filter((f) => /\.(html|xml|txt)$/.test(f))) {
  const t = readFileSync(f, 'utf8');
  if (t.includes('__SITE__')) writeFileSync(f, t.split('__SITE__').join(SITE));
}
// Vercel: the same security headers as _headers; mock pages are noindex by header too (they are never blocked in robots.txt,
// so crawlers can read the noindex). The practice portal may use the camera (the helper's photo step); nothing else may.
const SEC = [
  { key: 'Content-Security-Policy', value: CSP }, { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
const NOINDEX = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
writeFileSync(join(OUT, 'vercel.json'), JSON.stringify({
  cleanUrls: false,
  headers: [
    { source: '/(.*)', headers: SEC },
    { source: '/((?!portal/).*)', headers: [{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' }] },
    { source: '/portal/(.*)', headers: [...NOINDEX, { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' }] },
    { source: '/(book|week|demo|facilitator|hub)\.html', headers: NOINDEX },
    { source: '/downloads/(.*)', headers: NOINDEX },
  ],
}, null, 2));

// Zip the extension. Windows 10+ ships bsdtar as System32	ar.exe (GNU tar, e.g. Git Bash's, can't write zips,
// so it is called by full path); macOS tar is bsdtar too. Fallback: PowerShell Compress-Archive.
const ZIP = join(OUT, 'downloads', 'steady-extension.zip');
mkdirSync(dirname(ZIP), { recursive: true });
const isZip = () => { try { const b = Buffer.alloc(2), fd = openSync(ZIP, 'r'); readSync(fd, b, 0, 2, 0); closeSync(fd); return b.toString() === 'PK'; } catch { return false; } };
const tar = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe') : 'tar';
// List the top-level entries instead of '.', so paths are 'manifest.json', not './manifest.json'
// (Windows Explorer refuses to extract a zip with a './' entry: "Windows cannot complete the extraction").
const ENTRIES = readdirSync(APP).filter((n) => n !== 'downloads');
spawnSync(tar, ['-a', '-c', '-f', ZIP, '-C', APP, ...ENTRIES], { stdio: 'ignore' });
if (!isZip() && process.platform === 'win32') {
  rmSync(ZIP, { force: true });
  spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${join(APP, '*')}' -DestinationPath '${ZIP}' -Force`], { stdio: 'ignore' });
}
if (!isZip()) { console.error('Could not build downloads/steady-extension.zip (needs bsdtar or PowerShell).'); process.exitCode = 1; }
else console.log(`downloads/steady-extension.zip: ${Math.round(statSync(ZIP).size / 1024)} KB`);
// Same zip inside app/, so get.html's download link also works when you serve app/ directly in development.
if (isZip()) { mkdirSync(join(APP, 'downloads'), { recursive: true }); cpSync(ZIP, join(APP, 'downloads', 'steady-extension.zip')); console.log('also copied to app/downloads/ (git-ignored)'); }

const count = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(d, e.name)) : 1), 0);
console.log(`dist/web: ${count(OUT)} files. Deploy that folder to any static host (see README, "Deploy").`);
