#!/usr/bin/env python3
"""Genera assets/manifest.json: la lista de archivos que la pantalla de carga (boot.js) baja al arrancar.

Uso (desde la carpeta del juego):   python3 tools/crear_manifiesto.py

Qué entra:
  · la pelota, las canchas 3D (assets/*_court.glb), la imagen del menú y los escudos (logos/)
  · de cada jugador (assets/jugadores/<equipo>/<jugador>/): la camiseta de número más bajo (la Icon, que es la que se ve primero)
    y las demás camisetas solo si pesan poco (EXTRA_MB). Las pesadas se bajan al elegirlas, como siempre.
Si agregás un GLB y no volvés a correr esto, el juego igual lo encuentra y lo carga cuando lo necesita (solo que no cuenta en la barra).
Para cargar TODO al arrancar: python3 tools/crear_manifiesto.py --todo
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA_MB = 8.0
TODO = '--todo' in sys.argv

def size(p): return os.path.getsize(os.path.join(ROOT, p))
files = []
def add(p, kind):
    files.append({'u': p.replace(os.sep, '/'), 's': size(p), 'k': kind})

# v68: con las 30 canchas (~0,6 MB c/u) ya no se bajan todas al arrancar: solo la de arranque (GSW) y la del fondo de los sobres (All-Star). Las demás se bajan al usarlas. --todo las baja todas.
COURTS = sorted(glob.glob(os.path.join(ROOT, 'assets', '*_court.glb')))
if not TODO: COURTS = [c for c in COURTS if os.path.basename(c) in ('gsw_court.glb', 'asg_court.glb')]
for p in ['assets/ball.glb'] + COURTS:
    p = os.path.relpath(p, ROOT) if os.path.isabs(p) else p
    add(p, 'glb')
if os.path.exists(os.path.join(ROOT, 'assets/menu-hero.jpg')): add('assets/menu-hero.jpg', 'img')
for p in sorted(glob.glob(os.path.join(ROOT, 'logos', '*.png'))): add(os.path.relpath(p, ROOT), 'img')

pj = os.path.join(ROOT, 'assets', 'jugadores')
if os.path.isdir(pj):
    for team in sorted(os.listdir(pj)):
        td = os.path.join(pj, team)
        if not os.path.isdir(td): continue
        for pl in sorted(os.listdir(td)):
            d = os.path.join(td, pl)
            if not os.path.isdir(d): continue
            glbs = sorted(f for f in os.listdir(d) if f.lower().endswith('.glb'))
            def num(f):
                m = re.search(r'_(\d)\.glb$', f, re.I); return int(m.group(1)) if m else 0     # sin número = comodín: va primero
            glbs.sort(key=lambda f: (num(f) == 0 and -1 or num(f), f))
            for i, f in enumerate(glbs):
                rel = os.path.relpath(os.path.join(d, f), ROOT)
                if TODO or i == 0 or size(rel) <= EXTRA_MB * 1024 * 1024: add(rel, 'glb')

out = os.path.join(ROOT, 'assets', 'manifest.json')
json.dump({'v': 1, 'files': files}, open(out, 'w'), separators=(',', ':'))
tot = sum(f['s'] for f in files)
print(f'{len(files)} archivos, {tot / 1048576:.1f} MB  →  assets/manifest.json')
