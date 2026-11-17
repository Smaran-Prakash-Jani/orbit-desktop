// UI preview deliberately exposes fixture data only; no local filesystem or system API.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../ui');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' }); res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Orbit UI preview: http://127.0.0.1:4173 (sample data)'));
