import struct, json, sys
def load(p):
    b=open(p,'rb').read()
    magic,ver,length=struct.unpack('<III',b[:12])
    off=12; js=None; bin=None
    while off<length:
        l,t=struct.unpack('<II',b[off:off+8]); d=b[off+8:off+8+l]
        if t==0x4E4F534A: js=json.loads(d)
        elif t==0x004E4942: bin=d
        off+=8+l
    return js,bin
import numpy as np
def accessor(js,bin,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    ct={5126:'f4',5123:'u2',5125:'u4',5121:'u1'}[a['componentType']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride')
    dt=np.dtype(ct)
    if stride and stride!=n*dt.itemsize:
        arr=np.frombuffer(bin,dtype='u1',count=a['count']*stride,offset=off).reshape(a['count'],stride)[:,:n*dt.itemsize].copy().view(dt).reshape(a['count'],n)
    else:
        arr=np.frombuffer(bin,dtype=dt,count=a['count']*n,offset=off).reshape(a['count'],n)
    return arr
if __name__=='__main__':
    for p in sys.argv[1:]:
        js,bin=load(p)
        print('==',p, 'bin',len(bin) if bin else None)
        print('scenes',js['scenes'], 'extUsed',js.get('extensionsUsed'))
        for i,n in enumerate(js['nodes']):
            print(i,{k:v for k,v in n.items() if k!='children' or True})
        for mi,m in enumerate(js['meshes']):
            for pr in m['primitives']:
                acc=js['accessors'][pr['attributes']['POSITION']]
                print('mesh',mi,m.get('name'),'mat',pr.get('material'),'min',acc.get('min'),'max',acc.get('max'),'count',acc['count'])
        print('materials',[ (m.get('name'), m.get('pbrMetallicRoughness',{}).get('baseColorFactor')) for m in js['materials']])
        print('images',len(js.get('images',[])),'textures',len(js.get('textures',[])))
