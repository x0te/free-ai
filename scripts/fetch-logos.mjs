// 각 서비스의 공식 아이콘(apple-touch-icon / 사이트 선언 아이콘 / 파비콘)을 public/logos/<logo>.<ext> 로 저장.
// 사용: node scripts/fetch-logos.mjs [--force] [logo-key ...]
// 자동으로 안 되는 곳은 data/logos.json 에 { "logo-key": "https://직접/이미지/주소.png" } 로 지정.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/logos');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const overridesPath = path.join(ROOT, 'data/logos.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

fs.mkdirSync(OUT, { recursive: true });
const existing = new Set(fs.readdirSync(OUT).map((f) => f.replace(/\.[a-z0-9]+$/i, '')));

// logo 키 → 도메인/URL
const targets = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data/tools')).filter((f) => f.endsWith('.json'))) {
  for (const t of JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tools', f), 'utf8'))) {
    if (!t.logo || targets.has(t.logo)) continue;
    let host = t.logoDomain;
    try { host ||= new URL(t.url).hostname; } catch {}
    targets.set(t.logo, { domain: host, pageUrl: t.url });
  }
}

async function get(u, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(u, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const EXT = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function download(u) {
  try {
    const r = await get(u);
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    let ext = EXT[type];
    if (!ext) {
      // content-type이 부정확한 경우 시그니처로 판별
      if (buf.subarray(0, 4).toString('hex') === '89504e47') ext = 'png';
      else if (buf.subarray(0, 4).toString('hex') === '00000100') ext = 'ico';
      else if (/^\s*(<\?xml|<svg)/i.test(buf.subarray(0, 200).toString())) ext = 'svg';
      else if (buf.subarray(0, 3).toString('hex') === 'ffd8ff') ext = 'jpg';
    }
    if (!ext || buf.length < 150) return null;
    return { buf, ext };
  } catch {
    return null;
  }
}

function parseIcons(html, base) {
  const icons = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (tag.match(/\brel=["']?([^"'>]+)/i) || [])[1]?.toLowerCase() || '';
    if (!/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const href = (tag.match(/\bhref=["']?([^"'\s>]+)/i) || [])[1];
    if (!href) continue;
    const sizes = (tag.match(/\bsizes=["']?([^"'>]+)/i) || [])[1] || '';
    const type = (tag.match(/\btype=["']?([^"'>]+)/i) || [])[1] || '';
    const size = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let abs;
    try { abs = new URL(href.replace(/&amp;/g, '&'), base).href; } catch { continue; }
    const isSvg = /svg/.test(type) || /\.svg(\?|$)/i.test(abs);
    const score = (/apple-touch/.test(rel) ? 1000 : 0) + (isSvg ? 600 : 0) + size;
    icons.push({ url: abs, score });
  }
  return icons.sort((a, b) => b.score - a.score);
}

async function fetchLogo(key, { domain, pageUrl }) {
  if (overrides[key]) return download(overrides[key]);
  const candidates = [];
  for (const page of [...new Set([pageUrl, `https://${domain}/`])]) {
    try {
      const r = await get(page);
      if (r.ok) candidates.push(...parseIcons(await r.text(), r.url).filter((i) => i.score >= 96).map((i) => i.url));
    } catch {}
    if (candidates.length) break;
  }
  candidates.push(`https://${domain}/apple-touch-icon.png`);
  candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
  candidates.push(`https://${domain}/favicon.ico`);
  for (const c of candidates) {
    const got = await download(c);
    if (got) return { ...got, from: c };
  }
  return null;
}

const queue = [...targets].filter(([k]) => (only.length ? only.includes(k) : force || !existing.has(k)));
console.log(`로고 대상 ${queue.length}개 (전체 ${targets.size})`);
const failed = [];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const [key, info] = queue.shift();
      const got = await fetchLogo(key, info);
      if (!got) {
        failed.push(`${key} (${info.domain})`);
        continue;
      }
      for (const f of fs.readdirSync(OUT)) if (f.replace(/\.[a-z0-9]+$/i, '') === key) fs.rmSync(path.join(OUT, f));
      fs.writeFileSync(path.join(OUT, `${key}.${got.ext}`), got.buf);
      console.log(`✓ ${key}.${got.ext}  ← ${got.from || overrides[key]}`);
    }
  })
);
if (failed.length) console.log(`✗ 실패 ${failed.length}개: ${failed.join(', ')}\n  → data/logos.json 에 이미지 주소를 직접 지정하세요.`);
