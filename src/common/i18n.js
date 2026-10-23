// Idioma de la interfaz: español (original), inglés o portugués.
// Se elige con ?lang=es|en|pt, se recuerda en el navegador y, sin preferencia guardada, se toma del navegador.
// Los textos de las estaciones están escritos en español y se traducen al dibujarse con tr(), usando el
// diccionario de i18n-textos.js. Al buscar, las cifras se reemplazan por # para que los textos con valores
// que cambian (lecturas, pies de panel) también se traduzcan; las cifras se vuelven a poner en el mismo orden.
import { TEXTOS, UNIDADES } from './i18n-textos.js';

export const IDIOMAS = { es: 'Español', en: 'English', pt: 'Português' };
const LOCALES = { es: 'es-CL', en: 'en-US', pt: 'pt-BR' };
const CLAVE = 'g4-idioma';

function leer() { try { return localStorage.getItem(CLAVE); } catch { return null; } }
function guardar(l) { try { localStorage.setItem(CLAVE, l); } catch { /* sin almacenamiento */ } }

function detectar() {
  if (typeof window === 'undefined') return 'es';
  const p = new URLSearchParams(location.search).get('lang');
  if (p && p in IDIOMAS) { guardar(p); return p; }
  const g = leer();
  if (g && g in IDIOMAS) return g;
  const n = String(navigator.language || 'es').slice(0, 2).toLowerCase();
  return n in IDIOMAS ? n : 'es';
}

export const IDIOMA = detectar();
export const LOCALE = LOCALES[IDIOMA];
globalThis.__g4Locale = LOCALE; // lo leen las funciones de formato de src/math, que no tienen dependencias

// cifras con signo, separadores de miles y decimales (1.024 · 4,905 · −281.250 · 57,000)
const NUM = /[−-]?\d+(?:[.,]\d+)*/g;
const exacto = new Map(), plantillas = new Map();
const traducidos = new Set(); // textos ya traducidos: si vuelven a pasar por tr() quedan tal cual
if (IDIOMA !== 'es') {
  const i = IDIOMA === 'en' ? 1 : 2;
  for (const fila of TEXTOS) {
    const t = fila[i];
    if (!t) continue;
    exacto.set(fila[0], t);
    traducidos.add(t);
    const k = fila[0].replace(NUM, '#');
    if (!plantillas.has(k)) plantillas.set(k, t.replace(NUM, '#'));
  }
}
const unidades = IDIOMA === 'es' ? [] : UNIDADES.map(([re, en, pt]) => [new RegExp(re, 'g'), IDIOMA === 'en' ? en : pt]);

function buscar(s) {
  const e = exacto.get(s);
  if (e != null) return e;
  const cifras = [];
  const k = s.replace(NUM, (m) => { cifras.push(m); return '#'; });
  const t = plantillas.get(k);
  if (t == null) return null;
  let j = 0;
  return t.replace(/#/g, () => cifras[j++] ?? '#');
}

// textos que no hace falta traducir: cifras, unidades, variables y fórmulas
const NEUTRAS = new Set(['min', 'rad', 'sen', 'cos', 'tan', 'km', 'mi', 'dm', 'cm', 'mm', 'km/h', 'mi/h']);
function neutro(s) {
  const palabras = s.match(/[A-Za-zÁÉÍÓÚáéíóúÑñü]{3,}/g);
  return !palabras || palabras.every((p) => NEUTRAS.has(p));
}

const cache = new Map();
export const faltan = new Set();
// con ?i18n=revisar también se anotan los textos de lienzo sin traducción (incluye trozos de líneas cortadas)
const REVISAR = typeof location !== 'undefined' && new URLSearchParams(location.search).get('i18n') === 'revisar';
export const faltanLienzo = new Set();

function traducir(s, registrar) {
  if (IDIOMA === 'es' || s == null) return s;
  s = String(s);
  let r = cache.get(s);
  if (r !== undefined) return r;
  if (traducidos.has(s) && !exacto.has(s)) return s;
  r = buscar(s);
  if (r == null) {
    // texto compuesto: se traducen sus partes por separado (líneas, «·», «: »)
    const partes = s.split(/(\n| · |: )/);
    if (partes.length > 1) {
      let alguna = false;
      r = partes.map((p, i) => {
        if (i % 2 || !p.trim()) return p;
        const q = buscar(p.trim());
        if (q != null) { alguna = true; return p.replace(p.trim(), q); }
        return p;
      }).join('');
      if (!alguna) r = null;
    }
  }
  if (r == null) {
    // último recurso: solo las unidades (pies, pulgadas…)
    let u = s;
    for (const [re, t] of unidades) u = u.replace(re, t);
    if (u !== s) r = u;
  }
  if (r == null) {
    if (!neutro(s)) { if (registrar) faltan.add(s); else if (REVISAR) faltanLienzo.add(s); }
    r = s;
  }
  if (cache.size > 6000) cache.clear();
  cache.set(s, r);
  return r;
}

export function tr(s) { return traducir(s, true); }

// Todo texto que se dibuja en un lienzo pasa por aquí (rótulos, letreros y pantallas de las escenas).
// Las líneas cortadas por wrapText no están en el diccionario y quedan tal cual.
if (IDIOMA !== 'es' && typeof CanvasRenderingContext2D !== 'undefined') {
  const P = CanvasRenderingContext2D.prototype;
  const fill = P.fillText, stroke = P.strokeText, medir = P.measureText;
  P.fillText = function (t, ...a) { return fill.call(this, traducir(t, false), ...a); };
  P.strokeText = function (t, ...a) { return stroke.call(this, traducir(t, false), ...a); };
  P.measureText = function (t) { return medir.call(this, traducir(t, false)); };
}

export function cambiarIdioma(l) {
  if (!(l in IDIOMAS) || l === IDIOMA) return;
  guardar(l);
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  location.href = u.href;
}

// Selector de idioma para la barra de una página: <select> con las tres lenguas
export function selectorIdioma({ id = 'idioma', clase = 'btn idioma' } = {}) {
  const sel = document.createElement('select');
  sel.id = id; sel.className = clase;
  sel.setAttribute('aria-label', tr('Idioma'));
  sel.title = tr('Idioma');
  for (const [k, nombre] of Object.entries(IDIOMAS)) {
    const o = document.createElement('option');
    o.value = k; o.textContent = nombre; o.selected = k === IDIOMA;
    sel.appendChild(o);
  }
  sel.onchange = () => cambiarIdioma(sel.value);
  return sel;
}

// Traduce los textos fijos de una página: elementos con data-i18n (texto) o data-i18n-html (con marcas)
export function traducirPagina(raiz = document) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = IDIOMA;
  if (IDIOMA === 'es') return;
  raiz.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.textContent.trim()); });
  raiz.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = tr(el.innerHTML.trim().replace(/\s+/g, ' ')); });
  raiz.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = tr(el.title); });
  raiz.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', tr(el.getAttribute('aria-label'))); });
}

if (typeof window !== 'undefined') window.__i18n = { IDIOMA, LOCALE, tr, faltan, faltanLienzo };
