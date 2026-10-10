// Throttle Rider - original first-person motorbike highway rider in three.js (Hub build). @three
// Shares ../racer3x.js with Moto Lanes (bike: Grab3D CC0; rider: Quaternius CC0; Hub procedural car set). Cockpit camera.
import Racer from '../racer3x.js';
Racer({ id: 'gl-throttle-rider', title: 'THROTTLE RIDER', bike: true, fpv: true, speed: 26, vmax: 58,
  help: 'Steer: arrows / hold left or right side\nHelmet-cam highway run - near misses and overtakes multiply' });
