// Servidor estático para desarrollo, sin caché, en http://localhost:8123 (o el puerto que se indique).
// Uso: node tests/servidor.mjs [puerto]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PUERTO = Number(process.argv[2] || 8123);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  let info;
  try { info = statSync(archivo); } catch { res.writeHead(404).end('No encontrado'); return; }
  if (info.isDirectory()) { res.writeHead(302, { Location: ruta + '/' }).end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': info.size });
  createReadStream(archivo).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sirviendo ${RAIZ} en http://localhost:${PUERTO}`));
