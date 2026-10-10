// Ruin Runner - original jungle-temple lane runner in three.js (Hub build). @three
// Hero/chaser: Quaternius UBC + UAL (CC0). Nature: Quaternius Stylized Nature MegaKit (CC0). Ruins, blocks and set pieces built in code. Engine: ../runner3x.js
import RailRunner from '../runner3x.js';
RailRunner({ id: 'gl-ruin-runner', title: 'RUIN RUNNER', themes: ['jungle'], speed: 15, coinV: 10, sky: ['#5fb8a0', '#f3e7b0'],
  help: 'Swipe or arrows: change lane\nUp: jump, down: slide - vault the fallen temple blocks' });
