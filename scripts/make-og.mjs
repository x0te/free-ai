// 링크 미리보기(카톡·슬랙·X 등) 썸네일과 앱 아이콘을 만든다. 로컬 Chrome 필요.
//   public/og.png (1200×630), public/apple-touch-icon.png (180), public/icon-512.png (512)
// 사용: node scripts/make-og.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const config = readJSON('site.config.json');
const marks = readJSON('data/marks.json');
const hot = readJSON('data/hot.json').items;

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && fs.existsSync(p));
if (!CHROME) throw new Error('Chrome을 찾을 수 없습니다 (CHROME 환경변수로 지정)');

// 화제성 순 마크
const order = Object.entries(marks)
  .filter(([k]) => !k.startsWith('_'))
  .sort((a, b) => (hot[b[0]]?.score || 0) - (hot[a[0]]?.score || 0))
  .map(([, m]) => m)
  .filter((m, i, arr) => arr.indexOf(m) === i && fs.existsSync(path.join(ROOT, 'public/marks', m + '.svg')));
const svgOf = (m) => fs.readFileSync(path.join(ROOT, 'public/marks', m + '.svg'), 'utf8').replace(/<title>[\s\S]*?<\/title>/, '').replace(/ (width|height)="1em"/g, '');
const row = (list) => `<div class="row">${list.map((m) => `<i>${svgOf(m)}</i>`).join('')}</div>`;

const FONT = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">';
const ICON = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#111"/><circle cx="16" cy="16" r="6" fill="#34d399"/></svg>`;

const og = `<!doctype html><meta charset="utf-8">${FONT}<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#fff;color:#111;font-family:"Pretendard Variable",Pretendard,sans-serif;letter-spacing:-.02em;position:relative}
.row{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:46px;color:#111;opacity:.2;
  -webkit-mask-image:linear-gradient(to right,transparent,#000 18%,#000 82%,transparent)}
.row i{display:block;width:40px;height:40px;flex:none}.row svg{width:40px;height:40px;fill:currentColor;fill-rule:evenodd}
.top{top:44px}.bottom{bottom:44px}
main{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:22px}
.pill{font-size:24px;font-weight:650;color:#0e9f6e;border:2px solid #9fdcc3;border-radius:99px;padding:6px 20px;background:#fff}
h1{font-size:70px;line-height:1.18;font-weight:800;letter-spacing:-.035em}
.brand{display:flex;align-items:center;gap:12px;font-size:28px;font-weight:700;margin-top:6px}
.brand svg{width:40px;height:40px}.brand span{color:#8a8a8a;font-weight:500}
</style><body>
${row(order.slice(0, 14)).replace('class="row"', 'class="row top"')}
${row(order.slice(14, 28)).replace('class="row"', 'class="row bottom"')}
<main>
  <div class="pill">무료 생성형 AI 종합 게시판</div>
  <h1>지금 무료로 쓸 수 있는<br>생성형 AI, 매일 정리</h1>
  <div class="brand">${ICON}${config.title}<span>· ${new URL(config.baseUrl).host}</span></div>
</main>`;

const icon = (size) => `<!doctype html><style>*{margin:0}body{width:${size}px;height:${size}px;overflow:hidden;background:#111}</style><body>
<svg viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#111"/><circle cx="16" cy="16" r="7" fill="#34d399"/></svg>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
function shot(html, out, w, h) {
  const file = path.join(tmp, path.basename(out) + '.html');
  fs.writeFileSync(file, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, '--virtual-time-budget=6000', `--screenshot=${out}`, pathToFileURL(file).href], { stdio: 'ignore' });
  const b = fs.readFileSync(out);
  console.log(`${path.relative(ROOT, out)}  ${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`);
}
shot(og, path.join(ROOT, 'public/og.png'), 1200, 630);
shot(icon(512), path.join(ROOT, 'public/icon-512.png'), 512, 512);
shot(icon(180), path.join(ROOT, 'public/apple-touch-icon.png'), 180, 180);
fs.rmSync(tmp, { recursive: true, force: true });
