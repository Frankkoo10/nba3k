# Detecta en cada textura de piso dónde caen los bordes de la cancha (borde exterior de las líneas de límite).
import io, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from glbinfo import load, accessor
from PIL import Image
import numpy as np

def floor_image(path, floor_mat_name):
    js,bin=load(path)
    m=[m for m in js['materials'] if m.get('name')==floor_mat_name][0]
    ti=m['pbrMetallicRoughness']['baseColorTexture']['index']; src=js['textures'][ti]['source']
    im=js['images'][src]; bv=js['bufferViews'][im['bufferView']]
    data=bin[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    return Image.open(io.BytesIO(data)).convert('RGB')

def edges(img):
    a=np.asarray(img).astype(float); H,W,_=a.shape
    margin=np.median(np.concatenate([a[:20,:20].reshape(-1,3),a[-20:,-20:].reshape(-1,3),a[:20,-20:].reshape(-1,3)]),axis=0)
    # "parquet": claro y cálido, lejos del color de margen
    def isp(p):
        r,g,b=p; lum=.299*r+.587*g+.114*b
        return lum>135 and r>g>b and np.linalg.norm(p-margin)>45 and (r-b)>25
    # filas/columnas donde seguro hay solo parquet junto al borde (fuera del área pintada y de los logos)
    row=int(H*0.145); col=int(W*0.585)
    def first(line, rev=False):
        idx=range(len(line)-1,-1,-1) if rev else range(len(line))
        run=0
        for i in idx:
            if isp(line[i]): run+=1
            else: run=0
            if run>=6: return i+(5 if rev else -5)   # inicio de la corrida de parquet
        return None
    L=first(a[row]); R=first(a[row],True); T=first(a[:,col]); Bt=first(a[:,col],True)
    return W,H,L,R,T,Bt,margin

if __name__=='__main__':
    for n,p,mn in [('gsw','/home/claude/work/basket_3d_v41/assets/gsw_court.glb','White'),
                   ('spurs','/mnt/user-data/uploads/spurs_home_court.glb','White'),
                   ('rockets','/mnt/user-data/uploads/rockets_home_court.glb','White'),
                   ('hornets','/mnt/user-data/uploads/hornets_home_court.glb','White'),
                   ('lakers','/mnt/user-data/uploads/lakers_home_court.glb','White')]:
        W,H,L,R,T,B,mg=edges(floor_image(p,mn))
        print(n,W,H,'L',L,'R',R,'T',T,'B',B,'| frac',[round(v/W,4) if v is not None else None for v in (L,R)],[round(v/H,4) if v is not None else None for v in (T,B)],'margin',mg)
