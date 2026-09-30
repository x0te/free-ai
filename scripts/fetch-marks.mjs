// 히어로 배너용 단색 로고 마크(SVG)를 public/marks/<이름>.svg 로 받아온다.
// 매핑은 data/marks.json. 출처: @lobehub/icons-static-svg (MIT)
// 사용: node scripts/fetch-marks.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/marks');
const VERSION = '1.95.1';
const force = process.argv.includes('--force');

const names = [...new Set(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/marks.json'), 'utf8'))).filter(([k]) => !k.startsWith('_')).map(([, v]) => v))];
fs.mkdirSync(OUT, { recursive: true });

const failed = [];
for (const name of names) {
  const file = path.join(OUT, `${name}.svg`);
  if (!force && fs.existsSync(file)) continue;
  const r = await fetch(`https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@${VERSION}/icons/${name}.svg`);
  const svg = r.ok ? await r.text() : '';
  if (!svg.includes('<svg')) {
    failed.push(name);
    continue;
  }
  fs.writeFileSync(file, svg);
  console.log(`✓ ${name}.svg`);
}
if (failed.length) console.log(`✗ 없음: ${failed.join(', ')}`);
