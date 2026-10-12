// Captura una página del sitio con Chrome sin ventana (WebGL por software) y guarda un PNG.
// Uso: node tests/captura.mjs "<ruta?parámetros>" salida.png [ancho] [alto] [segundos de tiempo virtual]
// Requiere el servidor local (npm start) en el puerto 8123. La variable CHROME puede indicar el ejecutable.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [ruta, salida, ancho = '1280', alto = '720', segundos = '25'] = process.argv.slice(2);
if (!ruta || !salida) { console.error('Uso: node tests/captura.mjs "<ruta?parámetros>" salida.png [ancho] [alto] [segundos]'); process.exit(2); }
const candidatos = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = candidatos.find((c) => existsSync(c));
if (!chrome) { console.error('No encontré Chrome. Define la variable CHROME.'); process.exit(2); }
const perfil = mkdtempSync(join(tmpdir(), 'captura-'));
const url = ruta.startsWith('http') ? ruta : 'http://localhost:8123/' + ruta.replace(/^\//, '');
const t0 = Date.now();
const r = spawnSync(chrome, [
  '--headless=new', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--user-data-dir=${perfil}`, `--window-size=${ancho},${alto}`, `--virtual-time-budget=${Number(segundos) * 1000}`, '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', `--screenshot=${resolve(salida)}`, url,
], { encoding: 'utf8', timeout: 300000 });
try { rmSync(perfil, { recursive: true, force: true }); } catch { /* el perfil temporal se borra después */ }
const ok = existsSync(resolve(salida));
console.log(ok ? `Listo: ${salida} (${Math.round((Date.now() - t0) / 1000)} s)` : `Falló la captura. ${r.stderr?.slice(-800) || ''}`);
process.exit(ok ? 0 : 1);
