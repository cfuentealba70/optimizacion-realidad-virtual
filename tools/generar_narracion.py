# Genera la narración de cada escena (MP3) y sus subtítulos por oración (SRT).
# Español: assets/audio/narraciones.json -> assets/audio/<id>.mp3 y .srt
# Inglés y portugués: assets/audio/narraciones.<idioma>.json -> assets/audio/<idioma>/<id>.mp3 y .srt
# Requiere: pip install edge-tts. Uso: python tools/generar_narracion.py [--idioma es|en|pt] [id ...]   (sin ids, genera todas)
import asyncio
import json
import pathlib
import sys

import edge_tts

RAIZ = pathlib.Path(__file__).resolve().parent.parent
AUDIO = RAIZ / 'assets' / 'audio'


async def generar(destino, ident, texto, cfg):
    com = edge_tts.Communicate(texto, cfg['voz'], rate=cfg['velocidad'], pitch=cfg['tono'], boundary='SentenceBoundary')
    sub = edge_tts.SubMaker()
    with open(destino / f'{ident}.mp3', 'wb') as f:
        async for trozo in com.stream():
            if trozo['type'] == 'audio':
                f.write(trozo['data'])
            elif trozo['type'] in ('WordBoundary', 'SentenceBoundary'):
                sub.feed(trozo)
    (destino / f'{ident}.srt').write_text(sub.get_srt(), encoding='utf-8')


async def main():
    args = sys.argv[1:]
    idioma = 'es'
    if args[:1] == ['--idioma']:
        idioma, args = args[1], args[2:]
    origen = AUDIO / ('narraciones.json' if idioma == 'es' else f'narraciones.{idioma}.json')
    destino = AUDIO if idioma == 'es' else AUDIO / idioma
    destino.mkdir(exist_ok=True)
    cfg = json.loads(origen.read_text(encoding='utf-8'))
    pedidos = args or list(cfg['textos'])
    for ident in pedidos:
        for intento in range(3):
            try:
                await generar(destino, ident, cfg['textos'][ident], cfg)
                break
            except Exception as e:  # el servicio a veces corta la conexión: se reintenta
                print('reintento', ident, e)
                await asyncio.sleep(2)
        print(idioma, ident, (destino / f'{ident}.mp3').stat().st_size // 1024, 'KB')


asyncio.run(main())
