// V1 avatar editor: interactive WebGL preview with the existing SVG renderer as a compatibility fallback.
import { mountAvatar3D } from './avatar-3d.js';
let avatarCleanup = null;
let avatarController = null;
let C = null;
const KL = { bg: 'Background', skin: 'Skin', face: 'Face', hair: 'Hair', hairc: 'Hair color', eyes: 'Eyes', mouth: 'Mouth', beard: 'Facial hair', build: 'Body type', outfit: 'Outfit', hat: 'Hat', acc: 'Accessory', held: 'Held item' };
const lockText = (p) => p.owned ? '' : p.unlock.crowns ? `${p.unlock.crowns} Crowns` : p.unlock.ach ? `${p.unlock.ach} achievements` : p.unlock.prestige ? 'Prestige owners' : 'Locked';
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar unavailable', ''));
  const lr = await api('/api/avatar-looks'); let looks = lr.ok ? lr.looks : [];
  const cfg = { ...r.avatar }; let tab = 'hair'; let crowns = r.crowns;
  const baseAvatar = { ...r.avatar, gender: 'other' };
  for (const kind of r.kinds) { const free = r.parts.find(p => p.kind === kind && p.unlock === 'free'); if (free) baseAvatar[kind] = free.id; }
  const replaceCfg = (next) => { for (const key of Object.keys(cfg)) delete cfg[key]; Object.assign(cfg, next); };