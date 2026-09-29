// 화제성(🔥) 점수: 최근 30일 커뮤니티 언급량 → data/hot.json
// 소스: 디시인사이드 통합검색, 클리앙 검색, Hacker News(Algolia API)
// 검색 결과 첫 페이지가 며칠치를 덮는지로 30일 언급량을 추정한다 (많이 언급될수록 첫 페이지가 짧은 기간에 꽉 참).
// 사용: node scripts/hot.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/hot.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const DAY = 86400e3;
const WINDOW = 30;
const WEIGHT = { dc: 0.5, clien: 0.2, hn: 0.3 };

const terms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/hot-terms.json'), 'utf8'));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} };

// 항목 → 화제성 키 (항목 id에 검색어가 있으면 id, 아니면 logo)
const keys = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'data/tools')).filter((f) => f.endsWith('.json'))) {
  for (const t of JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tools', f), 'utf8'))) {
    if (t.status === 'ended') continue;
    const key = terms[t.id] ? t.id : t.logo;
    if (!keys.has(key)) keys.set(key, terms[key] || { ko: [], en: [t.platform.replace(/\s*[\(（].*?[\)）]/g, '').trim()] });
  }
}

async function get(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' }, signal: ctrl.signal });
      if (r.ok) return await r.text();
    } catch {}
    finally { clearTimeout(timer); }
    await sleep(1500);
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 첫 페이지 결과들 → 30일 언급량 추정.
// 검색이 단어를 느슨하게 매칭하므로(예: "메타 뮤즈" → "던파 뮤즈") 제목·미리보기에 검색어가 그대로 있는 결과만 센다.
const norm = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, '').toLowerCase();
function estimate(items, q, fullPage) {
  const now = Date.now();
  const needle = norm(q);
  const within = items.filter((i) => now - i.date <= WINDOW * DAY);
  if (!within.length) return 0;
  const relevant = within.filter((i) => norm(i.text).includes(needle)).length;
  if (within.length === items.length && items.length >= fullPage) {
    const span = Math.max((now - Math.min(...within.map((i) => i.date))) / DAY, 0.25);
    return Math.round((relevant * WINDOW) / span);
  }
  return relevant;
}

const SOURCES = {
  dc: {
    url: (q) => `https://search.dcinside.com/post/p/1/q/${encodeURIComponent(q)}`,
    parse: (html, q) => {
      const list = html.split('class="sch_result_list"')[1]?.split('</ul>')[0] ?? '';
      const items = list.split('<li>').slice(1).map((li) => {
        const m = li.match(/<span class="date_time">(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})/);
        return m && { date: Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`), text: li.split('dsc_sub')[0] };
      }).filter(Boolean);
      return estimate(items, q, 20);
    },
  },
  clien: {
    url: (q) => `https://www.clien.net/service/search?q=${encodeURIComponent(q)}&sort=recency&boardCd=&isBoard=false`,
    parse: (html, q) => {
      const items = html.split('data-role="list-row"').slice(1).map((row) => {
        const m = row.match(/<span class="timestamp">(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
        const title = row.match(/data-role="list-title-text" title="([^"]*)"/)?.[1] ?? '';
        const preview = row.match(/<div class="preview">([\s\S]*?)<\/div>/)?.[1] ?? '';
        return m && { date: Date.parse(`${m[1]}T${m[2]}+09:00`), text: title + ' ' + preview };
      }).filter(Boolean);
      return estimate(items, q, 15);
    },
  },
  hn: {
    url: (q) => `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${q}"`)}&typoTolerance=false&hitsPerPage=0&numericFilters=created_at_i>${Math.floor((Date.now() - WINDOW * DAY) / 1000)}`,
    parse: (body) => JSON.parse(body).nbHits ?? null,
  },
};

// 소스별로 순차 + 간격 (사이트 부담 최소화), 소스끼리는 병렬
const jobs = { dc: [], clien: [], hn: [] };
const results = {};
for (const [key, t] of keys) {
  results[key] = { dc: 0, clien: 0, hn: 0, failed: new Set() };
  for (const q of [...(t.ko || []), ...(t.en || [])]) jobs.dc.push([key, q]), jobs.clien.push([key, q]);
  for (const q of t.en || []) jobs.hn.push([key, q]);
}
let done = 0;
const total = jobs.dc.length + jobs.clien.length + jobs.hn.length;
await Promise.all(
  Object.entries(jobs).map(async ([src, list]) => {
    for (const [key, q] of list) {
      const body = await get(SOURCES[src].url(q));
      let n = null;
      try { n = body == null ? null : SOURCES[src].parse(body, q); } catch {}
      if (n == null) results[key].failed.add(src);
      else results[key][src] += n;
      if (++done % 50 === 0) console.log(`  ${done}/${total}`);
      await sleep(src === 'hn' ? 120 : 400);
    }
  })
);

// 실패한 소스는 이전 값 유지
const items = {};
for (const [key, r] of Object.entries(results)) {
  const old = prev.items?.[key] || {};
  items[key] = Object.fromEntries(['dc', 'clien', 'hn'].map((s) => [s, r.failed.has(s) ? old[s] ?? 0 : r[s]]));
}
const max = Object.fromEntries(['dc', 'clien', 'hn'].map((s) => [s, Math.max(1, ...Object.values(items).map((i) => i[s]))]));
for (const i of Object.values(items)) {
  i.score = +Object.entries(WEIGHT).reduce((sum, [s, w]) => sum + (w * Math.log1p(i[s])) / Math.log1p(max[s]), 0).toFixed(3);
}

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const failedCount = Object.values(results).filter((r) => r.failed.size).length;
fs.writeFileSync(
  OUT,
  JSON.stringify({ updated: today, windowDays: WINDOW, sources: ['디시인사이드', '클리앙', 'Hacker News'], items: Object.fromEntries(Object.entries(items).sort((a, b) => b[1].score - a[1].score)) }, null, 1) + '\n'
);
const top = Object.entries(items).sort((a, b) => b[1].score - a[1].score).slice(0, 25);
console.log(`화제성 갱신: ${keys.size}개 (일부 소스 실패 ${failedCount}개 → 이전 값 사용)`);
for (const [k, v] of top) console.log(`${k.padEnd(24)} ${String(v.score).padEnd(6)} dc=${v.dc} clien=${v.clien} hn=${v.hn}`);
