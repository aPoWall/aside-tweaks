// Read-only preview: product docs here, shared AIM assets from an existing checkout.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const landings = path.resolve(repo, '../../_landings');
const candidates = ['lab-sites', 'lab-sites-product-system-20260908', 'lab-sites-space-scroll-20260907'];
const shared = process.env.AIM_APPS_PREVIEW_ROOT ? [process.env.AIM_APPS_PREVIEW_ROOT] : [
  path.resolve(repo, '../../../../repos/lab-sites/sites/apps'),
  ...candidates.map(name => path.join(landings, name, 'sites/apps'))
];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const port = Number(process.env.ASIDE_PREVIEW_PORT || 8927);
http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const product = url === '/' || url.startsWith('/aside-tweaks/');
  const relative = product ? url.replace(/^\/aside-tweaks\/?|^\//, '') || 'index.html' : url.slice(1);
  const roots = product ? [path.join(repo, 'docs')] : shared;
  for (const root of roots) {
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(path.resolve(root) + path.sep)) continue;
    try {
      const bytes = await fs.readFile(filename);
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes); return;
    } catch {}
  }
  res.writeHead(404); res.end('Not found');
}).listen(port, '0.0.0.0', () => console.log(`Aside preview: http://localhost:${port}/aside-tweaks/ · LAN binding 0.0.0.0`));
