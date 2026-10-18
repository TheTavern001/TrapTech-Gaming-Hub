// Throttle Rider - original first-person motorbike highway rider in three.js (Hub build). @three
// Shares ../racer3x.js with Moto Lanes (bike: Grab3D CC0; rider: Quaternius CC0; Hub procedural car set). Cockpit camera.
import Racer from '../racer3x.js'; import { skyProps } from '../sky3d.js';
Racer({ id: 'gl-throttle-rider', title: 'THROTTLE RIDER', bike: true, fpv: true, speed: 26, vmax: 58,
  help: 'Steer: arrows / hold left or right side\nHelmet-cam highway run - near misses and overtakes multiply' });
// v8: horizon sky life (clouds + hot-air balloon + birds); attaches to the racer scene once it exists, ticks on its own rAF
(function () { let SKY = null, tries = 0; (function loop() { if (!SKY && window.__SCENE) { SKY = skyProps({ scale: 0.55, bx: -30, by: 12, bz: -110 }); window.__SCENE.add(SKY.group); } if (SKY) SKY.tick(performance.now() / 1000, { position: { x: 0, z: 5.6 } }); if (SKY || ++tries < 600) requestAnimationFrame(loop); })(); })();
