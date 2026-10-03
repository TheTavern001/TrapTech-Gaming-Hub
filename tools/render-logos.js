// Renders PNG fallbacks of the SVG logos (used by OG share cards and the PNG favicon).
const { Resvg } = require('@resvg/resvg-js'); const fs = require('fs'); const B = 'public/assets/brand/';
for (const [f, w] of [['traptech-wordmark', 920], ['traptech-stacked', 680], ['hub-logo', 1100], ['hub-stacked', 640], ['hub-mark', 480], ['favicon', 192], ['traptech-mark', 256]]) {
  const png = new Resvg(fs.readFileSync(B + f + '.svg'), { fitTo: { mode: 'width', value: w }, background: 'rgba(0,0,0,0)' }).render().asPng();
  fs.writeFileSync('/tmp/' + f + '.png', png); console.log(f, png.length);
}
// app icons (PWA / home screen) from the vector favicon
for (const [f, w] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  const svg = fs.readFileSync(B + 'favicon.svg', 'utf8').replace('rx="26"', f === 'apple-touch-icon' ? 'rx="0"' : 'rx="26"');
  fs.writeFileSync('public/assets/icons/' + f + '.png', new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng());
}
for (const f of ['favicon', 'hub-logo', 'traptech-wordmark', 'hub-mark']) fs.copyFileSync('/tmp/' + f + '.png', B + f + '.png');
