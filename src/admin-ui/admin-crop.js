// v7 admin: upload + crop dialog. The browser lets the admin frame the picture for each card size (drag to move, slider to
// zoom), downsizes it (max 2400 px, JPEG) and sends the bytes + normalised crop boxes; the server makes the exact PNGs.
import { esc, icon, toast } from './admin-shared.js';
export const ASPECT = { card: [800, 450, 'Card (16:9)'], tall: [600, 620, 'Tall card'], square: [512, 512, 'Square'], banner: [1200, 300, 'Banner (4:1)'], badge: [256, 256, 'Badge'], og: [1200, 630, 'Share image'] };
const CSRF = (document.querySelector('meta[name=csrf]') || {}).content || '';
export function cropUpload({ kinds = ['card'], kind = 'giveaway', title = 'Upload image' } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'v7dlg-wrap';
    wrap.innerHTML = `<div class="v7dlg card crop-dlg" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>
      <label class="drop" id="cdrop">${icon('upload')}<span>Choose a JPEG or PNG <small>(phone photos are fine; it is resized before upload)</small></span><input type="file" accept="image/png,image/jpeg" id="cfile" hidden></label>
      <div id="cwork" hidden><p class="small muted">Drag each frame to choose what shows, and use the slider to zoom.</p><div class="crop-grid">${kinds.map(k => `<div class="crop-it" data-kind="${k}"><div class="crop-box" style="aspect-ratio:${ASPECT[k][0]}/${ASPECT[k][1]}" tabindex="0" aria-label="${esc(ASPECT[k][2])} crop, drag or use arrow keys"></div>
        <div class="crop-ctl"><span class="small">${esc(ASPECT[k][2])}</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom ${esc(ASPECT[k][2])}"></div></div>`).join('')}</div></div>
      <div class="row-end"><button class="btn ghost" data-x>Cancel</button><button class="btn" data-ok disabled>${icon('upload')} Upload</button></div><p class="small" id="cmsg" role="status"></p></div>`;
    document.body.appendChild(wrap);
    const st = {}; let img = null, url = null;
    const close = (v) => { if (url) URL.revokeObjectURL(url); wrap.remove(); resolve(v); };
    wrap.querySelector('[data-x]').onclick = () => close(null);
    const paint = (k) => {
      const s = st[k]; const [aw, ah] = ASPECT[k]; const A = aw / ah; const W = img.naturalWidth, H = img.naturalHeight;
      const bw = Math.min(W, H * A) / s.z, bh = bw / A;
      s.cx = Math.min(1 - bw / W / 2, Math.max(bw / W / 2, s.cx)); s.cy = Math.min(1 - bh / H / 2, Math.max(bh / H / 2, s.cy));
      const x = s.cx * W - bw / 2, y = s.cy * H - bh / 2; s.box = { x: x / W, y: y / H, w: bw / W, h: bh / H };
      const el = wrap.querySelector(`[data-kind="${k}"] .crop-box`);
      el.style.backgroundImage = `url("${url}")`; el.style.backgroundSize = `${(W / bw) * 100}% auto`;
      el.style.backgroundPosition = `${W - bw > 0.5 ? (x / (W - bw)) * 100 : 0}% ${H - bh > 0.5 ? (y / (H - bh)) * 100 : 0}%`;
    };
    wrap.querySelector('#cfile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!/^image\/(png|jpeg)$/.test(f.type)) { wrap.querySelector('#cmsg').textContent = 'Use a JPEG or PNG.'; return; }
      url = URL.createObjectURL(f); img = new Image(); img.onload = () => {
        wrap.querySelector('#cwork').hidden = false; wrap.querySelector('#cdrop').classList.add('small-drop'); wrap.querySelector('[data-ok]').disabled = false;
        for (const k of kinds) { st[k] = { z: 1, cx: 0.5, cy: 0.5 }; paint(k);
          const it = wrap.querySelector(`[data-kind="${k}"]`); const box = it.querySelector('.crop-box'); const rng = it.querySelector('input');
          rng.oninput = () => { st[k].z = +rng.value; paint(k); };
          let drag = null;
          box.onpointerdown = (ev) => { drag = { x: ev.clientX, y: ev.clientY }; box.setPointerCapture(ev.pointerId); };
          box.onpointermove = (ev) => { if (!drag) return; const r = box.getBoundingClientRect(); const s = st[k];
            s.cx -= ((ev.clientX - drag.x) / r.width) * s.box.w; s.cy -= ((ev.clientY - drag.y) / r.height) * s.box.h; drag = { x: ev.clientX, y: ev.clientY }; paint(k); };
          box.onpointerup = box.onpointercancel = () => { drag = null; };
          box.onkeydown = (ev) => { const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }[ev.key]; if (!d) return; ev.preventDefault(); st[k].cx += d[0]; st[k].cy += d[1]; paint(k); };
        }
      }; img.src = url;
    };
    wrap.querySelector('[data-ok]').onclick = async () => {
      const btn = wrap.querySelector('[data-ok]'); btn.disabled = true; const msg = wrap.querySelector('#cmsg'); msg.textContent = 'Uploading...';
      try {
        const max = 2400; const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
        const crops = Object.fromEntries(kinds.map(k => [k, st[k].box]));
        const res = await fetch(`/api/admin/v7/media?kind=${encodeURIComponent(kind)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': CSRF, 'X-Crops': JSON.stringify(crops) }, body: blob });
        const d = await res.json(); if (!d.ok) { msg.textContent = d.error || 'Upload failed.'; btn.disabled = false; return; }
        toast('Image uploaded'); close(d.urls);
      } catch (e) { msg.textContent = 'Upload failed: ' + e.message; btn.disabled = false; }
    };
  });
}
