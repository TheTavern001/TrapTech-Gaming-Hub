# Download Poly Haven 1k glTF packages (CC0) into <dest>/<id>/ via curl; usage: python3 -I phfetch.py <dest> id...
import json, os, subprocess, sys
dest = sys.argv[1]
for mid in sys.argv[2:]:
    info = json.loads(subprocess.check_output(['curl', '-sf', '-m', '60', f'https://api.polyhaven.com/files/{mid}']))
    g = info['gltf']['1k']['gltf']; d = os.path.join(dest, mid); os.makedirs(d, exist_ok=True)
    items = [(os.path.basename(g['url']), g['url'])] + [(k, v['url']) for k, v in g.get('include', {}).items()]
    for rel, url in items:
        out = os.path.join(d, rel); os.makedirs(os.path.dirname(out), exist_ok=True)
        if not os.path.exists(out): subprocess.check_call(['curl', '-sf', '-m', '600', '-o', out, url])
    print(mid, 'ok', len(items))
