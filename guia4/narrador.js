// Narración en audio de cada escena: una voz explica de qué trata el problema y qué opciones ofrece la estación.
// Los archivos están en assets/audio (<id>.mp3 y <id>.srt, generados con tools/generar_narracion.py).
// Los navegadores no reproducen audio antes del primer gesto de la persona: si se pide antes, queda pendiente
// y empieza con el primer clic, toque o al entrar en VR. La preferencia (activada o no) se recuerda en el navegador.
export function crearNarrador({ base, alTexto = () => {}, alEstado = () => {} }) {
  const audio = new Audio();
  audio.preload = 'auto';
  const guardado = (() => { try { return localStorage.getItem('g4-narracion'); } catch { return null; } })();
  let activo = guardado !== '0';
  let actual = null, pendiente = null, frases = [], ultimoTexto = '';
  const srt = new Map();

  const seg = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms / 1000;
  async function cargarFrases(id) {
    if (!srt.has(id)) {
      srt.set(id, fetch(base + id + '.srt').then((r) => (r.ok ? r.text() : '')).then((t) => t.split(/\r?\n\r?\n/).map((b) => {
        const m = b.match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)\s*\r?\n([\s\S]*)/);
        return m ? { ini: seg(m[1], m[2], m[3], m[4]), fin: seg(m[5], m[6], m[7], m[8]), texto: m[9].trim().replace(/\s+/g, ' ') } : null;
      }).filter(Boolean)).catch(() => []));
    }
    return srt.get(id);
  }
  function mostrar(t) { if (t !== ultimoTexto) { ultimoTexto = t; alTexto(t); } }
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    const f = frases.find((x) => t >= x.ini - 0.05 && t < x.fin + 0.25);
    mostrar(f ? f.texto : '');
  });
  audio.addEventListener('ended', () => { mostrar(''); alEstado(); });
  audio.addEventListener('play', () => alEstado());
  audio.addEventListener('pause', () => alEstado());

  async function reproducir(id, { forzar = false } = {}) {
    if (!id) return;
    if (!activo && !forzar) { actual = id; return; }
    if (id === actual && !forzar && !audio.paused && !audio.ended) return; // ya se está narrando esta escena
    actual = id; pendiente = null;
    audio.pause(); mostrar('');
    frases = [];
    cargarFrases(id).then((f) => { if (actual === id) frases = f; });
    audio.src = base + id + '.mp3';
    try { await audio.play(); } catch { pendiente = id; }
    alEstado();
  }
  function detener() { audio.pause(); pendiente = null; mostrar(''); alEstado(); }
  function setActivo(v) {
    activo = v;
    try { localStorage.setItem('g4-narracion', v ? '1' : '0'); } catch { /* sin almacenamiento */ }
    if (!v) detener(); else if (actual) reproducir(actual);
    alEstado();
  }
  // el primer gesto de la persona libera la narración pendiente
  const liberar = () => { if (pendiente && activo) { const p = pendiente; pendiente = null; reproducir(p); } };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, liberar, { capture: true });

  return {
    reproducir, detener, setActivo, liberar,
    repetir: () => reproducir(actual, { forzar: true }),
    activo: () => activo,
    hablando: () => !audio.paused && !audio.ended,
    actual: () => actual,
  };
}
