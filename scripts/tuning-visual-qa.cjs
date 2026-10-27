// Isolated atlas comparisons for all calibrated models, without production writes.
const { chromium } = require(process.env.CHS_QA_PLAYWRIGHT || 'playwright');
const http = require('node:http'), path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..'), out = process.env.CHS_QA_OUTPUT || '/tmp/chs-tuning-details';
const studio = require('../vehicle-studio'), rewards = require('../vehicle-rewards');
fs.mkdirSync(out, { recursive: true });
const cars = [
  ...['E21', 'E30', 'E36', 'E46', 'E90', 'F30', 'G20'].map((series, i) => ({ brand: 'BMW', model: '3er', series, year: [1980, 1989, 1996, 2003, 2009, 2016, 2022][i], body: i === 0 ? 'Coupé' : 'Limousine' })),
  { brand: 'BMW', model: 'M2', series: 'F87', year: 2018 },
  { brand: 'BMW', model: 'M2', series: 'G87', year: 2024 },
  { brand: 'BMW', model: '2er', series: 'F22', year: 2018, body: 'Coupé' },
  { brand: 'BMW', model: '2er', series: 'G42', year: 2024, body: 'Coupé' },
  { brand: 'BMW', model: '3er', series: 'E36', year: 1996, body: 'Coupé' }
];
(async () => {
  const server = http.createServer(require('../server').handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
    const base = `<base href="http://127.0.0.1:${server.address().port}/">`;
    for (const car of cars) assert.ok(studio.render(car), 'Missing model ' + car.series);
    for (let batch = 0; batch < 4; batch++) {
      let html = base + '<style>body{background:#283340;color:white;font:14px Arial;margin:0;display:grid;grid-template-columns:repeat(4,390px)}section{padding:14px;border:1px solid #697582}svg{width:100%;height:195px;display:block}</style>';
      for (const car of cars.slice(batch * 3, batch * 3 + 3)) {
        for (const rims of ['stock', 'silver', 'graphite', 'mesh']) {
          html += `<section>${car.series} ${car.body || ''} · ${rims}${studio.render({ ...car, color: 'Silber', cosmetics: { rims, package: 'track', glow: 'cyan' } })}</section>`;
        }
      }
      await page.setContent(html);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: out + '/models-' + batch + '.png', fullPage: true });
    }
    let html = base + '<style>body{background:#233143;color:white;font:16px Arial;display:grid;grid-template-columns:repeat(4,270px);gap:10px}svg{width:270px;height:180px;background:#17212d}section{padding:6px}</style>';
    for (const car of [cars[2], cars[11]]) {
      for (const value of ['stock', 'clean', 'sport', 'track']) {
        html += `<section>${car.series} ${car.body} ${value}${rewards.preview('package', value, car)}${rewards.partDescriptions[value]}</section>`;
      }
    }
    await page.setContent(html);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: out + '/packages.png', fullPage: true });
    console.log(JSON.stringify({ models: cars.length, rimStyles: 4, packageDetails: 8, out }));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
