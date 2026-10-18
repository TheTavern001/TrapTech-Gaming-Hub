#!/usr/bin/env python3
"""Pack source PNGs (Kenney CC0 / own renders) into one WebP atlas emitted as a JS data-URI module.
usage: pack.py <out-name> <spec.json>   spec: {"sprites":[["name","path",targetWidthPx],...],"q":82}
Output: public/assets/v8/<out-name>.js  (export default {i:'data:image/webp;base64,..', f:{name:[x,y,w,h]}})"""
import sys,json,base64,io,os
from PIL import Image
name,spec=sys.argv[1],json.load(open(sys.argv[2]))
ims=[]
for n,p,w in spec['sprites']:
    im=Image.open(p).convert('RGBA'); w=round(w*spec.get('sc',1)) if w else w
    if w and im.width!=w: im=im.resize((w,max(1,round(im.height*w/im.width))),Image.LANCZOS)
    ims.append((n,im))
ims.sort(key=lambda t:-t[1].height)
AW=spec.get('aw',1024); x=y=rh=0; pos={}
for n,im in ims:
    if x+im.width+2>AW: x=0;y+=rh+2;rh=0
    pos[n]=(x,y,im.width,im.height); x+=im.width+2; rh=max(rh,im.height)
AH=y+rh+2
atlas=Image.new('RGBA',(AW,AH),(0,0,0,0))
for n,im in ims: atlas.paste(im,pos[n][:2])
b=io.BytesIO(); atlas.save(b,'WEBP',quality=spec.get('q',82),method=6); data=b.getvalue()
out=os.path.join(os.path.dirname(__file__),'..','..','public','assets','v8',name+'.js')
open(out,'w').write("export default "+json.dumps({'i':'data:image/webp;base64,'+base64.b64encode(data).decode(),'f':{n:list(p) for n,p in pos.items()}},separators=(',',':'))+";\n")
print(name,AW,AH,len(data)//1024,'KB webp',os.path.getsize(out)//1024,'KB js')
