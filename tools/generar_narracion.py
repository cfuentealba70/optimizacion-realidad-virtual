# Genera la narración de cada escena (MP3) y sus subtítulos por oración (SRT) a partir de assets/audio/narraciones.json.
# Requiere: pip install edge-tts. Uso: python tools/generar_narracion.py [id ...]   (sin ids, genera todas)
import asyncio
import json
import pathlib
import sys

import edge_tts

RAIZ = pathlib.Path(__file__).resolve().parent.parent
AUDIO = RAIZ / 'assets' / 'audio'


async def generar(ident, texto, cfg):
    com = edge_tts.Communicate(texto, cfg['voz'], rate=cfg['velocidad'], pitch=cfg['tono'], boundary='SentenceBoundary')
    sub = edge_tts.SubMaker()
    with open(AUDIO / f'{ident}.mp3', 'wb') as f:
        async for trozo in com.stream():
            if trozo['type'] == 'audio':
                f.write(trozo['data'])
            elif trozo['type'] in ('WordBoundary', 'SentenceBoundary'):
                sub.feed(trozo)
    (AUDIO / f'{ident}.srt').write_text(sub.get_srt(), encoding='utf-8')


async def main():
    cfg = json.loads((AUDIO / 'narraciones.json').read_text(encoding='utf-8'))
    pedidos = sys.argv[1:] or list(cfg['textos'])
    for ident in pedidos:
        for intento in range(3):
            try:
                await generar(ident, cfg['textos'][ident], cfg)
                break
            except Exception as e:  # el servicio a veces corta la conexión: se reintenta
                print('reintento', ident, e)
                await asyncio.sleep(2)
        print(ident, (AUDIO / f'{ident}.mp3').stat().st_size // 1024, 'KB')


asyncio.run(main())
