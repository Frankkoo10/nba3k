# Calibra las canchas 3D (Sketchfab, plantilla de los Warriors) al tamaño del juego, igual que assets/gsw_court.glb:
#   · piso: las líneas de límite caen en z=±14,325 (fondo) y x=±7,62 (banda); y = 0,005
#   · soportes y tableros: escala uniforme 1,0365e-3, girados 180° en X (el modelo viene "cabeza abajo"), centrados en el medio de la cancha
#   · se sacan el aro y la red del modelo (el juego tiene los suyos con física), el faldón de abajo del piso y el cristal invisible
#   · las texturas de 4096 se bajan a 1024 (el piso queda en 2048)
import sys, io, json, struct
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import numpy as np
from PIL import Image
from glbinfo import load, accessor
from calib import edges, floor_image

K = 1.0365e-3                        # escala de soportes y tableros (la de la cancha de los Warriors)
CX, CZ, FLOOR_Y = 9812.05, 16925.29, 3800.18
HALF_L, HALF_W = 14.325, 7.62        # medio largo y medio ancho de la cancha del juego
KEEP = [0, 3, 6, 7, 8, 9, 10, 11, 12, 13]        # mallas que se quedan (se van: 1 aro, 2 faldón, 4 red, 5 cristal invisible)
NAMES = {0: 'aro_Indigo', 3: 'piso', 6: 'aro_White_2', 7: 'aro_White_3', 8: 'aro_White_4', 9: 'aro_White_5', 10: 'aro_White_6', 11: 'aro_White_7', 12: 'aro_White_8', 13: 'aro_Yellow'}

def encode(img, keep_alpha, size, jpg_q=88):
    if size and max(img.size) > size: img = img.resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    if keep_alpha: img.save(b, 'PNG', optimize=True); return b.getvalue(), 'image/png'
    img.convert('RGB').save(b, 'JPEG', quality=jpg_q, optimize=True, progressive=True); return b.getvalue(), 'image/jpeg'

def convert(src, dst, name):
    js, bin_ = load(src)
    # --- calibración del piso a partir de la textura ---
    fimg = floor_image(src, 'White'); W, H, L, R, T, B, _ = edges(fimg)
    L -= 2; R += 3; T -= 2; B += 3                       # el borde exterior de la línea de límite está ~2 px más afuera que el parquet
    uL, uR, vT, vB = 1 + L / W, 1 + R / W, 1 + T / H, 1 + B / H
    out_bin = bytearray(); bvs = []; accs = []; meshes = []; nodes = []; mats = []; texs = []; imgs = []
    def add_view(data, target=None):
        while len(out_bin) % 4: out_bin.append(0)
        bvs.append({'buffer': 0, 'byteOffset': len(out_bin), 'byteLength': len(data), **({'target': target} if target else {})}); out_bin.extend(data); return len(bvs) - 1
    def add_acc(arr, ctype, atype, target, minmax=False):
        v = add_view(arr.tobytes(), target)
        a = {'bufferView': v, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
        if minmax: a['min'] = arr.min(0).astype(float).tolist(); a['max'] = arr.max(0).astype(float).tolist()
        accs.append(a); return len(accs) - 1
    mat_map, tex_map = {}, {}
    def get_tex(ti, floor):
        if ti in tex_map: return tex_map[ti]
        src_i = js['textures'][ti]['source']; im = js['images'][src_i]; bv = js['bufferViews'][im['bufferView']]
        raw = bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]; pil = Image.open(io.BytesIO(raw))
        alpha = pil.mode in ('RGBA', 'LA', 'P') and im['mimeType'] == 'image/png'
        size = 2048 if floor else (512 if pil.mode == 'LA' else 1024)
        data, mime = encode(pil.convert('RGBA' if pil.mode in ('RGBA', 'P') else 'LA' if pil.mode == 'LA' else 'RGB'), alpha, size, 90 if floor else 86)
        imgs.append({'bufferView': add_view(data), 'mimeType': mime}); texs.append({'sampler': 0, 'source': len(imgs) - 1}); tex_map[ti] = len(texs) - 1; return tex_map[ti]
    def get_mat(mi, floor):
        if mi in mat_map: return mat_map[mi]
        m = json.loads(json.dumps(js['materials'][mi])); bt = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if bt: bt['index'] = get_tex(bt['index'], floor)
        if floor: m['pbrMetallicRoughness']['roughnessFactor'] = 0.45
        mats.append(m); mat_map[mi] = len(mats) - 1; return mat_map[mi]
    for mi in KEEP:
        pr = js['meshes'][mi]['primitives'][0]
        pos = accessor(js, bin_, pr['attributes']['POSITION']).astype(np.float64); uv = accessor(js, bin_, pr['attributes']['TEXCOORD_0']).astype(np.float32)
        nor = accessor(js, bin_, pr['attributes']['NORMAL']).astype(np.float64); idx = accessor(js, bin_, pr['indices']).ravel().astype(np.uint32)
        floor = mi == 3
        if floor:                                          # el piso se arma desde las UV: las líneas de la textura caen justo en los límites de la cancha del juego
            u, v = uv[:, 0].astype(np.float64), uv[:, 1].astype(np.float64)
            z = (u - uL) / (uR - uL) * 2 * HALF_L - HALF_L; x = (v - vT) / (vB - vT) * 2 * HALF_W - HALF_W
            P = np.stack([x, np.full_like(x, 0.005), z], 1); N = np.tile(np.array([0, 1, 0], np.float64), (len(P), 1))
        else:                                              # girar 180° en X + escala uniforme + centrar
            P = np.stack([(pos[:, 0] - CX) * K, (FLOOR_Y - pos[:, 1]) * K, (CZ - pos[:, 2]) * K], 1)
            N = np.stack([nor[:, 0], -nor[:, 1], -nor[:, 2]], 1)
        ia = add_acc(P.astype(np.float32), 5126, 'VEC3', 34962, True); na = add_acc(N.astype(np.float32), 5126, 'VEC3', 34962); ta = add_acc(uv, 5126, 'VEC2', 34962)
        use16 = len(P) < 65535; ii = add_acc(idx.astype(np.uint16 if use16 else np.uint32), 5123 if use16 else 5125, 'SCALAR', 34963)
        meshes.append({'name': NAMES[mi], 'primitives': [{'attributes': {'POSITION': ia, 'NORMAL': na, 'TEXCOORD_0': ta}, 'indices': ii, 'material': get_mat(pr['material'], floor), 'mode': 4}]})
        nodes.append({'name': NAMES[mi], 'mesh': len(meshes) - 1})
    root = {'name': 'cancha', 'children': list(range(1, len(nodes) + 1))}
    all_nodes = [root] + nodes
    while len(out_bin) % 4: out_bin.append(0)
    asset = dict(js['asset']); asset['generator'] = 'calibrada para Basket 3D'
    glb = {'asset': asset, 'scene': 0, 'scenes': [{'name': name, 'nodes': [0]}], 'nodes': all_nodes, 'meshes': meshes, 'materials': mats, 'textures': texs, 'images': imgs,
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(out_bin)}]}
    jb = json.dumps(glb, separators=(',', ':')).encode(); jb += b' ' * ((4 - len(jb) % 4) % 4)
    blob = bytes(out_bin); blob += b'\0' * ((4 - len(blob) % 4) % 4)
    data = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(blob)) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(blob), 0x004E4942) + blob
    open(dst, 'wb').write(data)
    print(f'{name}: {len(data)/1e6:.2f} MB  bordes px L{L} R{R} T{T} B{B}  uL={uL:.4f} uR={uR:.4f} vT={vT:.4f} vB={vB:.4f}')

if __name__ == '__main__':
    # uso: python3 tools/calibrar_cancha.py spurs_home_court.glb sas      ->  assets/sas_court.glb
    import os
    if len(sys.argv) != 3: sys.exit('uso: python3 tools/calibrar_cancha.py <archivo.glb> <abreviatura del equipo, ej. sas>')
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', sys.argv[2].lower() + '_court.glb')
    convert(sys.argv[1], out, sys.argv[2])
    print("Listo. Ahora agregá  model: 'assets/%s_court.glb', apron: '#colorDelContorno'  al bloque del equipo en courts.js" % sys.argv[2].lower())
