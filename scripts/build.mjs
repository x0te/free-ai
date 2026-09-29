// 데이터(data/*.json) → 정적 사이트(dist/) 빌드. 외부 의존성 없음.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const config = readJSON('site.config.json');
const categories = readJSON('data/categories.json');
const changelog = readJSON('data/changelog.json').sort((a, b) => b.date.localeCompare(a.date));
const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
// BASE_PATH 환경변수로 덮어쓸 수 있음: free-ai.today 용은 '', x0te.github.io/free-ai 용은 '/free-ai'
const BASE = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
const url = (p = '') => `${BASE}/${p}`.replace(/\/+/g, '/');
const abs = (p = '') => config.baseUrl.replace(/\/$/, '') + '/' + p.replace(/^\//, '');

// ── 날짜 (KST 기준) ──────────────────────────────────────────────
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400e3);
const shortDate = (d) => (d ? d.slice(5).replace('-', '.') : '');

// ── 데이터 로드 & 검증 ──────────────────────────────────────────
const errors = [];
const tools = [];
for (const file of fs.readdirSync(path.join(ROOT, 'data/tools')).filter((f) => f.endsWith('.json')).sort()) {
  let arr;
  try {
    arr = readJSON(`data/tools/${file}`);
  } catch (e) {
    errors.push(`${file}: JSON 파싱 실패 — ${e.message}`);
    continue;
  }
  for (const t of arr) {
    for (const k of ['id', 'category', 'platform', 'url', 'headline', 'description', 'freeTier']) {
      if (!t[k]) errors.push(`${file} → ${t.id || '(id 없음)'}: '${k}' 누락`);
    }
    if (t.category && !catById[t.category]) errors.push(`${file} → ${t.id}: 알 수 없는 category '${t.category}'`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(t.id || '')) errors.push(`${file} → ${t.id}: id는 소문자 kebab-case`);
    tools.push({
      access: 'official',
      status: 'active',
      confidence: 'medium',
      models: [],
      tags: [],
      howTo: [],
      sources: [],
      added: t.lastVerified || today,
      updated: t.lastVerified || today,
      ...t,
      freeTier: t.freeTier || {},
    });
  }
}
const seen = new Set();
for (const t of tools) {
  if (seen.has(t.id)) errors.push(`중복 id: ${t.id}`);
  seen.add(t.id);
}
if (errors.length) {
  console.error('데이터 오류:\n  ' + errors.join('\n  '));
  process.exit(1);
}

// ── 로고 ────────────────────────────────────────────────────────
const logoFiles = fs.existsSync(path.join(ROOT, 'public/logos')) ? fs.readdirSync(path.join(ROOT, 'public/logos')) : [];
const logoMap = {};
for (const f of logoFiles) {
  const key = f.replace(/\.[a-z0-9]+$/i, '');
  if (!logoMap[key] || f.endsWith('.svg')) logoMap[key] = f;
}

// ── 파생 플래그 (flags 필드가 있으면 우선) ────────────────────────
function deriveFlags(t) {
  const f = t.freeTier;
  const head = (x) => (x || '').split(/[(（]/)[0]; // 괄호 속 부연("이전의 매일 리셋 폐지" 등)은 무시
  const reset = head(f.reset);
  const wm = head(f.watermark);
  const signup = f.signup || '';
  const com = f.commercialUse || '';
  const out = {};
  out.reset = /무제한|unlimited/i.test(reset) ? 'unlimited'
    : /매일|일일|하루|daily|24시간/i.test(reset) ? 'daily'
    : /매주|주간|weekly/i.test(reset) ? 'weekly'
    : /매월|월간|monthly|매달/i.test(reset) ? 'monthly'
    : /1회|가입 시|일회|한 번/.test(reset) ? 'once' : 'unknown';
  out.watermark = /없음|없이|no watermark/i.test(wm) && !/있음/.test(wm) ? 'none'
    : /SynthID|비가시|C2PA|메타데이터/i.test(wm) && !/(가시|로고|visible)[^,.;]*있음/i.test(wm) ? 'invisible'
    : /있음|visible|로고|워터마크/i.test(wm) ? 'visible' : 'unknown';
  out.login = !/로그인 ?불필요|가입 ?불필요|no (login|sign)/i.test(signup);
  out.commercial = /^\s*(가능|허용|yes)/i.test(com) ? true : /불가|금지|비상업|no/i.test(com) ? false : null;
  return { ...out, ...(t.flags || {}) };
}
for (const t of tools) t.flags = deriveFlags(t);

// ── 화제성 (scripts/hot.mjs 가 만든 data/hot.json) ─────────────────
const hotData = fs.existsSync(path.join(ROOT, 'data/hot.json')) ? readJSON('data/hot.json') : { items: {} };
const hotTerms = readJSON('data/hot-terms.json');
for (const t of tools) {
  t.hotKey = hotTerms[t.id] ? t.id : t.logo;
  t.hot = hotData.items[t.hotKey] || { score: 0, dc: 0, clien: 0, hn: 0 };
  // 정렬용 점수: 무료가 제한적인 항목은 조금 뒤로
  t.rank = t.hot.score * (t.status === 'limited' ? 0.75 : 1);
}

const RESET_LABEL = { unlimited: '무제한', daily: '매일 충전', weekly: '매주 충전', monthly: '매월 충전', once: '가입 시 1회' };
const WM_LABEL = { none: '워터마크 없음', invisible: '비가시 워터마크', visible: '워터마크' };
const CONF_LABEL = { high: '확실', medium: '대체로 확실', low: '확인 필요' };
const ACCESS_LABEL = { official: '공식', wrapper: 'Wrapper', opensource: '오픈소스' };
const TYPE_LABEL = { new: '신규', update: '변경', ended: '종료', promo: '이벤트', check: '점검', fix: '정정' };

const isPromoActive = (t) => t.promo && t.promo.text && (!/^\d{4}-\d{2}-\d{2}$/.test(t.promo.until || '') || t.promo.until >= today);
// 사이트 오픈일에 일괄 등록된 항목에는 NEW를 달지 않는다
const launchDate = changelog.length ? changelog[changelog.length - 1].date : today;
const isNew = (t) => t.added > launchDate && daysBetween(t.added, today) <= 3;
const isUpdated = (t) => !isNew(t) && t.updated > launchDate && daysBetween(t.updated, today) <= 3;

const CONF_RANK = { high: 3, medium: 2, low: 1 };
const sortTools = (list) =>
  [...list].sort(
    (a, b) =>
      (a.status === 'ended') - (b.status === 'ended') ||
      b.rank - a.rank ||
      (CONF_RANK[b.confidence] || 0) - (CONF_RANK[a.confidence] || 0) ||
      (a.access === 'wrapper') - (b.access === 'wrapper') ||
      a.platform.localeCompare(b.platform)
  );

// 🔥: 전체 화제성 상위 HOT_TOP개 플랫폼 + 카테고리별 상위 3개(점수 0.3 이상)
const HOT_TOP = 12;
const byScore = tools.filter((t) => t.status !== 'ended').sort((a, b) => b.rank - a.rank);
const hotKeys = new Set([...new Set(byScore.map((t) => t.hotKey))].slice(0, HOT_TOP));
for (const t of byScore) t.isHot = hotKeys.has(t.hotKey);
for (const c of categories) byScore.filter((t) => t.category === c.id && t.rank >= 0.3).slice(0, 3).forEach((t) => (t.isHot = true));
const hotBadge = (t) => (t.isHot ? '<span class="hot" title="최근 30일 커뮤니티 언급 상위">🔥</span>' : '');

// 모델명 정규화: 괄호 부연 제거
const modelKey = (m) => m.replace(/\s*[\(（].*?[\)）]\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// ── HTML 헬퍼 ───────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeHref = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '#');

function logo(t, size = 28) {
  const f = logoMap[t.logo];
  if (f) return `<img class="logo" src="${url('logos/' + f)}" alt="${esc(t.platform)} 로고" width="${size}" height="${size}" loading="lazy">`;
  return `<span class="logo logo-fallback" style="width:${size}px;height:${size}px" aria-hidden="true">${esc(t.platform.trim()[0] || '?')}</span>`;
}

function flagData(t) {
  const f = t.flags;
  return [
    t.access,
    f.reset === 'daily' || f.reset === 'unlimited' ? 'daily' : '',
    f.watermark === 'none' ? 'nowm' : '',
    f.login ? '' : 'nologin',
    f.commercial === true ? 'commercial' : '',
    isPromoActive(t) ? 'promo' : '',
  ].filter(Boolean).join(' ');
}

function row(t, { showCat = true } = {}) {
  const f = t.flags;
  const meta = [
    showCat ? `<span class="tag">${esc(catById[t.category].name)}</span>` : '',
    t.access !== 'official' ? `<span class="tag tag-line">${ACCESS_LABEL[t.access] || t.access}</span>` : '',
    RESET_LABEL[f.reset] ? `<span>${RESET_LABEL[f.reset]}</span>` : '',
    WM_LABEL[f.watermark] ? `<span>${WM_LABEL[f.watermark]}</span>` : '',
    !f.login ? '<span>로그인 불필요</span>' : '',
    f.commercial === true ? '<span>상업 이용 가능</span>' : '',
  ].filter(Boolean).join('');
  const badges = [
    t.status === 'ended' ? '<span class="badge badge-end">무료 불가</span>' : '',
    t.status === 'limited' ? '<span class="badge">제한적</span>' : '',
    isPromoActive(t) ? '<span class="badge badge-promo">이벤트</span>' : '',
    isNew(t) ? '<span class="badge badge-new">NEW</span>' : isUpdated(t) ? '<span class="badge">UP</span>' : '',
  ].join('');
  const q = [t.platform, t.vendor, ...t.models, t.headline, ...t.tags, catById[t.category].name].join(' ').toLowerCase();
  return `<li class="row${t.status === 'ended' ? ' is-ended' : ''}" data-flags="${flagData(t)}" data-q="${esc(q)}" data-score="${t.status === 'ended' ? -1 : t.rank.toFixed(3)}" data-updated="${t.updated}">
  <a href="${url('t/' + t.id + '/')}">
    ${logo(t)}
    <div class="row-main">
      <div class="row-title">${hotBadge(t)}<strong>${esc(t.platform)}</strong>${t.models.length ? `<span class="row-models">${esc(t.models.slice(0, 4).join(' · '))}${t.models.length > 4 ? ` 외 ${t.models.length - 4}` : ''}</span>` : ''}${badges}</div>
      <div class="row-head">${esc(t.headline)}</div>
      <div class="row-meta">${meta}</div>
    </div>
    <time class="row-date" datetime="${t.updated}" title="마지막 변경 ${t.updated}">${shortDate(t.updated)}</time>
  </a>
</li>`;
}

const toolbar = () => `<div class="toolbar" role="search">
  <input id="q" type="search" placeholder="모델·사이트 검색  (예: 나노바나나, veo, suno)" autocomplete="off" aria-label="검색">
  <div class="chips" role="group" aria-label="필터">
    <button type="button" class="chip" data-f="official">공식</button>
    <button type="button" class="chip" data-f="wrapper">Wrapper</button>
    <button type="button" class="chip" data-f="daily">매일 충전</button>
    <button type="button" class="chip" data-f="nowm">워터마크 없음</button>
    <button type="button" class="chip" data-f="nologin">로그인 불필요</button>
    <button type="button" class="chip" data-f="commercial">상업 이용 가능</button>
    <button type="button" class="chip" data-f="promo">이벤트 중</button>
  </div>
  <div class="sortbar">
    <div class="seg" role="group" aria-label="정렬">
      <button type="button" data-sort="hot" aria-pressed="true">🔥 인기순</button>
      <button type="button" data-sort="new" aria-pressed="false">최신순</button>
    </div>
    <span class="hot-note">🔥 최근 30일 디시인사이드·클리앙·Hacker News 언급량 상위${hotData.updated ? ` · ${hotData.updated} 기준` : ''}</span>
  </div>
</div>
<p class="empty" id="empty" hidden>조건에 맞는 글이 없습니다.</p>`;

const lastUpdate = changelog[0]?.date || today;

function layout({ title, desc, path: p, body, active = '', hero = '' }) {
  const fullTitle = title ? `${title} · ${config.title}` : `${config.title} — 무료 생성형 AI 게시판`;
  const nav = [
    ['', '전체'],
    ...categories.map((c) => [`c/${c.id}/`, c.name]),
  ];
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc || config.tagline)}">
<link rel="canonical" href="${abs(p)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.title)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc || config.tagline)}">
<meta property="og:url" content="${abs(p)}">
<script>try{var m=localStorage.getItem('theme');if(m==='light'||m==='dark')document.documentElement.dataset.theme=m}catch(e){}</script>
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e0e0e" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.title)} 업데이트" href="${url('feed.xml')}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${url('style.css')}">
</head>
<body>
<header class="site-head">
  <div class="wrap head-top">
    <a class="brand" href="${url()}"><span class="brand-dot" aria-hidden="true"></span>${esc(config.title)}</a>
    <nav class="head-links">
      <a href="${url('models/')}"${active === 'models' ? ' aria-current="page"' : ''}>모델별</a>
      <a href="${url('updates/')}"${active === 'updates' ? ' aria-current="page"' : ''}>업데이트</a>
      <a href="${url('board/')}"${active === 'board' ? ' aria-current="page"' : ''}>제보·질문</a>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="라이트/다크 테마 전환" title="테마 전환">
        <svg class="i-moon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        <svg class="i-sun" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </nav>
  </div>
  <nav class="wrap cat-nav" aria-label="카테고리">
    ${nav.map(([h, n]) => `<a href="${url(h)}"${active === (h || 'home') ? ' aria-current="page"' : ''}>${esc(n)}</a>`).join('')}
  </nav>
</header>
${hero}
<main class="wrap">
${body}
</main>
<footer class="wrap site-foot">
  <p>${esc(config.title)} · 마지막 업데이트 ${lastUpdate} · 무료 정책은 수시로 바뀌니 사용 전 공식 페이지를 확인하세요.</p>
  <p>로고와 상표는 각 회사의 소유입니다. · <a href="${url('feed.xml')}">RSS</a> · <a href="${url('data.json')}">JSON</a> · <a href="https://github.com/${config.repo}">GitHub</a></p>
</footer>
<script src="${url('app.js')}" defer></script>
</body>
</html>`;
}

function comments(term) {
  const g = config.giscus;
  if (!g.repoId || !g.categoryId) {
    return `<p class="muted">댓글 기능 준비 중입니다. <a href="https://github.com/${config.repo}/discussions">GitHub 토론</a>에 남겨주세요.</p>`;
  }
  // giscus 스크립트는 app.js가 현재 테마(라이트/다크)에 맞춰 삽입
  return `<div class="giscus-slot"
  data-repo="${esc(config.repo)}" data-repo-id="${esc(g.repoId)}"
  data-category="${esc(g.category)}" data-category-id="${esc(g.categoryId)}"
  data-mapping="specific" data-term="${esc(term)}" data-strict="1"
  data-reactions-enabled="1" data-emit-metadata="0" data-input-position="top"
  data-lang="ko" data-loading="lazy"></div>`;
}

function changeItems(entry, limit = Infinity) {
  const items = entry.items.slice(0, limit);
  return `<ul class="changes">${items
    .map((it) => {
      const t = tools.find((x) => x.id === it.id);
      const label = `<span class="ctype ctype-${esc(it.type)}">${TYPE_LABEL[it.type] || esc(it.type)}</span>`;
      const text = t ? `<a href="${url('t/' + t.id + '/')}">${esc(it.text)}</a>` : esc(it.text);
      return `<li>${label}${text}</li>`;
    })
    .join('')}${entry.items.length > limit ? `<li class="more"><a href="${url('updates/')}">외 ${entry.items.length - limit}건 더 보기</a></li>` : ''}</ul>`;
}

// ── 페이지 ─────────────────────────────────────────────────────
const pages = {};

// 홈
{
  const promos = sortTools(tools.filter(isPromoActive));
  const latest = changelog[0];
  const active = tools.filter((t) => t.status !== 'ended');
  const sections = categories
    .map((c) => {
      const list = sortTools(tools.filter((t) => t.category === c.id));
      if (!list.length) return '';
      return `<section class="board" data-board>
  <div class="board-head"><h2><a href="${url('c/' + c.id + '/')}">${esc(c.name)}</a></h2><span class="count">${list.length}</span><a class="board-more" href="${url('c/' + c.id + '/')}">게시판 보기</a></div>
  <ol class="rows">${list.map((t) => row(t, { showCat: false })).join('')}</ol>
</section>`;
    })
    .join('');
  // 히어로 배경: 화제성 순 로고가 3줄로 흐름 (각 줄은 두 번 반복해 끊김 없이 순환)
  // 같은 이미지를 쓰는 플랫폼(예: ChatGPT·Codex)은 한 번만
  const logoTools = [];
  const seenLogo = new Set();
  for (const t of byScore) {
    const f = logoMap[t.logo];
    if (!f) continue;
    const digest = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'public/logos', f))).digest('hex');
    if (seenLogo.has(digest)) continue;
    seenLogo.add(digest);
    logoTools.push(t);
  }
  const PER_ROW = 14;
  const mqRows = [0, 1, 2].map((r) => logoTools.slice(r * PER_ROW, (r + 1) * PER_ROW)).filter((r) => r.length);
  const tile = (t, hidden) =>
    `<a class="mq-tile" href="${url('t/' + t.id + '/')}" title="${esc(t.platform)}"${hidden ? ' tabindex="-1" aria-hidden="true"' : ''}><img src="${url('logos/' + logoMap[t.logo])}" alt="${hidden ? '' : esc(t.platform)}" width="30" height="30"></a>`;
  const hero = `<section class="hero">
  <div class="hero-bg">${mqRows
    .map((r, i) => `<div class="mq-row mq-row-${i}"><div class="mq-track">${r.map((t) => tile(t)).join('')}${r.map((t) => tile(t, true)).join('')}</div></div>`)
    .join('')}</div>
  <div class="hero-fg wrap">
    <p class="hero-kicker">무료 생성형 AI 종합 게시판</p>
    <h1>${esc(config.tagline)}</h1>
    <p class="muted">공식 서비스부터 Magnific(구 Freepik)·Krea·Higgsfield 같은 Wrapper 사이트까지, 무료 계정으로 무엇을 몇 개 만들 수 있는지 적어둡니다. 매일 커뮤니티와 공식 공지를 확인해 갱신합니다.</p>
    <p class="stats"><span><b>${active.length}</b>개 서비스</span><span><b>${new Set(tools.flatMap((t) => t.models.map(modelKey))).size}</b>개 모델</span><span>업데이트 <b>${lastUpdate}</b></span></p>
  </div>
</section>`;
  pages['index.html'] = layout({
    path: '',
    active: 'home',
    hero,
    body: `
${promos.length ? `<section class="panel panel-promo"><h2>진행 중인 무료 이벤트</h2><ul class="promo-list">${promos
      .map((t) => `<li><a href="${url('t/' + t.id + '/')}">${logo(t, 18)}<b>${esc(t.platform)}</b><span>${esc(t.promo.text)}</span>${t.promo.until && /^\d/.test(t.promo.until) ? `<time>~${shortDate(t.promo.until)}</time>` : ''}</a></li>`)
      .join('')}</ul></section>` : ''}
${latest ? `<section class="panel"><h2>${latest.date} 변경 사항 <a class="panel-more" href="${url('updates/')}">전체 로그</a></h2>${latest.summary ? `<p class="muted">${esc(latest.summary)}</p>` : ''}${changeItems(latest, 8)}</section>` : ''}
${toolbar()}
${sections}`,
  });
}

// 카테고리
for (const c of categories) {
  const list = sortTools(tools.filter((t) => t.category === c.id));
  pages[`c/${c.id}/index.html`] = layout({
    title: `${c.name} 무료 AI`,
    desc: `${c.desc} — 무료로 쓸 수 있는 곳 ${list.length}개 정리 (${lastUpdate} 기준)`,
    path: `c/${c.id}/`,
    active: `c/${c.id}/`,
    body: `<section class="intro intro-sm"><h1>${esc(c.name)} <span class="count">${list.length}</span></h1><p class="muted">${esc(c.desc)}</p></section>
${toolbar()}
<section class="board" data-board><ol class="rows">${list.map((t) => row(t, { showCat: false })).join('')}</ol></section>`,
  });
}

// 글 상세
// 모델 → 무료 사용처 (같은 카테고리, 무료 불가 항목 제외)
const byModel = {};
const modelLabel = (m) => m.replace(/\s*[\(（].*?[\)）]/g, '').trim();
for (const t of tools) {
  if (t.status === 'ended') continue;
  for (const m of t.models) (byModel[t.category + ':' + modelKey(m)] ||= { label: modelLabel(m), cat: t.category, list: [] }).list.push(t);
}

for (const t of tools) {
  const c = catById[t.category];
  const f = t.freeTier;
  const facts = [
    ['무료 한도', f.quota],
    ['충전 주기', f.reset],
    ['워터마크', f.watermark],
    ['상업적 이용', f.commercialUse],
    ['가입', f.signup],
    ['한국 사용', f.korea],
    ['제약·메모', f.notes],
  ].filter(([, v]) => v);
  const siblings = tools.filter((x) => x.logo === t.logo && x.id !== t.id);
  const alsoFree = [];
  for (const m of t.models) {
    for (const x of byModel[t.category + ':' + modelKey(m)]?.list || []) if (x.id !== t.id && !alsoFree.includes(x)) alsoFree.push(x);
  }
  pages[`t/${t.id}/index.html`] = layout({
    title: `${t.platform}${t.models.length ? ' — ' + t.models.slice(0, 3).join(', ') : ''} 무료 사용법`,
    desc: t.headline,
    path: `t/${t.id}/`,
    active: `c/${t.category}/`,
    body: `<article class="post">
  <nav class="crumbs"><a href="${url()}">홈</a><span>/</span><a href="${url('c/' + c.id + '/')}">${esc(c.name)}</a></nav>
  <header class="post-head">
    ${logo(t, 44)}
    <div>
      <h1>${hotBadge(t)}${esc(t.platform)}</h1>
      <p class="muted">${esc(t.vendor || '')}${t.vendor ? ' · ' : ''}<span class="tag tag-line">${ACCESS_LABEL[t.access] || esc(t.access)}</span>${t.status === 'ended' ? ' <span class="badge badge-end">무료 불가</span>' : t.status === 'limited' ? ' <span class="badge">제한적</span>' : ''}</p>
    </div>
  </header>
  ${t.models.length ? `<ul class="model-chips">${t.models.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
  <p class="headline">${esc(t.headline)}</p>
  ${isPromoActive(t) ? `<div class="promo-box"><b>이벤트</b> ${esc(t.promo.text)}${t.promo.until ? ` <span class="muted">(~${esc(t.promo.until)})</span>` : ''}</div>` : ''}
  <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  <p><a class="cta" href="${safeHref(t.url)}" target="_blank" rel="noopener">${esc(t.platform)} 바로가기 ↗</a></p>
  <h2>소개</h2>
  <p>${esc(t.description)}</p>
  ${t.howTo.length ? `<h2>사용 방법</h2><ol class="steps">${t.howTo.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
  ${alsoFree.length ? `<h2>같은 모델을 무료로 쓸 수 있는 다른 곳</h2><ol class="rows rows-compact">${sortTools(alsoFree).map((x) => row(x)).join('')}</ol>` : ''}
  ${siblings.length ? `<h2>${esc(t.platform)}의 다른 무료 기능</h2><ol class="rows rows-compact">${siblings.map((x) => row(x)).join('')}</ol>` : ''}
  ${t.sources.length ? `<h2>출처</h2><ul class="sources">${t.sources
      .map((s) => `<li><span class="stype">${s.type === 'official' ? '공식' : s.type === 'community' ? '커뮤니티' : '뉴스'}</span><a href="${safeHref(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title || s.url)}</a>${s.date ? `<span class="muted"> · ${esc(s.date)}</span>` : ''}</li>`)
      .join('')}</ul>` : ''}
  <p class="verify">${t.status !== 'ended' ? `${t.isHot ? '🔥 ' : ''}화제성: 최근 30일 커뮤니티 언급 약 ${(t.hot.dc + t.hot.clien + t.hot.hn).toLocaleString('ko-KR')}건 (디시 ${t.hot.dc.toLocaleString('ko-KR')} · 클리앙 ${t.hot.clien.toLocaleString('ko-KR')} · HN ${t.hot.hn.toLocaleString('ko-KR')})<br>` : ''}마지막 확인 ${esc(t.lastVerified || t.updated)} · 신뢰도 <span class="conf conf-${esc(t.confidence)}">${CONF_LABEL[t.confidence] || esc(t.confidence)}</span> · 등록 ${esc(t.added)}<br>무료 조건은 예고 없이 바뀝니다. 틀리거나 바뀐 정보는 아래 댓글로 알려주세요.</p>
  <section class="comments"><h2>댓글 · 사용 후기</h2>${comments('tool:' + t.id)}</section>
</article>`,
  });
}

// 모델별
{
  const groups = categories
    .map((c) => {
      const models = Object.values(byModel)
        .filter((m) => m.cat === c.id)
        .sort((a, b) => b.list.length - a.list.length || a.label.localeCompare(b.label));
      if (!models.length) return '';
      return `<section class="board" data-board><div class="board-head"><h2>${esc(c.name)}</h2><span class="count">${models.length}</span></div>
<dl class="model-index">${models
        .map(
          (m) => `<div class="model-item" data-q="${esc((m.label + ' ' + m.list.map((t) => t.platform).join(' ')).toLowerCase())}"><dt>${esc(m.label)}</dt><dd>${sortTools(m.list)
            .map((t) => `<a href="${url('t/' + t.id + '/')}" title="${esc(t.headline)}">${logo(t, 16)}${esc(t.platform)}</a>`)
            .join('')}</dd></div>`
        )
        .join('')}</dl></section>`;
    })
    .join('');
  pages['models/index.html'] = layout({
    title: '모델별 무료 사용처',
    desc: 'Nano Banana, Veo, Suno 등 모델별로 무료로 쓸 수 있는 사이트 모음',
    path: 'models/',
    active: 'models',
    body: `<section class="intro intro-sm"><h1>모델별 보기</h1><p class="muted">같은 모델이라도 사이트마다 무료 한도가 다릅니다. 모델 이름 → 무료로 쓸 수 있는 곳.</p></section>
<div class="toolbar"><input id="q" type="search" placeholder="모델 검색 (예: nano banana, veo 3.1, seedance)" autocomplete="off" aria-label="모델 검색"></div>
<p class="empty" id="empty" hidden>찾는 모델이 없습니다.</p>
${groups}`,
  });
}

// 업데이트 로그
pages['updates/index.html'] = layout({
  title: '업데이트 로그',
  desc: '무료 AI 정보 변경 기록',
  path: 'updates/',
  active: 'updates',
  body: `<section class="intro intro-sm"><h1>업데이트 로그</h1><p class="muted">매일 확인한 변경 사항입니다. <a href="${url('feed.xml')}">RSS로 구독</a></p></section>
${changelog.map((e) => `<section class="log" id="d${e.date}"><h2><a href="#d${e.date}">${e.date}</a></h2>${e.summary ? `<p class="muted">${esc(e.summary)}</p>` : ''}${changeItems(e)}</section>`).join('')}`,
});

// 제보·질문 게시판
pages['board/index.html'] = layout({
  title: '제보·질문 게시판',
  desc: '새로운 무료 AI 제보, 질문, 자유 이야기',
  path: 'board/',
  active: 'board',
  body: `<section class="intro intro-sm"><h1>제보·질문</h1><p class="muted">새로 발견한 무료 AI, 바뀐 한도, 끝난 이벤트를 알려주세요. 다음 업데이트 때 확인해서 반영합니다. 각 서비스 글 하단에도 댓글을 달 수 있습니다.</p></section>
<section class="comments">${comments('board:general')}</section>
<p class="muted">더 긴 이야기는 <a href="https://github.com/${config.repo}/discussions">GitHub 토론 게시판</a>에서.</p>`,
});

pages['404.html'] = layout({
  title: '페이지 없음',
  path: '404.html',
  body: `<section class="intro"><h1>페이지를 찾을 수 없습니다.</h1><p><a href="${url()}">홈으로</a></p></section>`,
});

// ── 출력 ───────────────────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
const write = (rel, content) => {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
for (const [rel, html] of Object.entries(pages)) write(rel, html);

// 정적 파일
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, f));

// data.json
write('data.json', JSON.stringify({ updated: lastUpdate, categories, tools: sortTools(tools) }, null, 1));

// RSS
write(
  'feed.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(config.title)}</title><link>${abs()}</link><description>${esc(config.tagline)}</description><language>ko</language>
${changelog
  .slice(0, 30)
  .map(
    (e) => `<item><title>${e.date} 업데이트${e.summary ? ' — ' + esc(e.summary) : ''}</title><link>${abs('updates/#d' + e.date)}</link><guid isPermaLink="false">update-${e.date}</guid><pubDate>${new Date(e.date + 'T09:00:00+09:00').toUTCString()}</pubDate><description>${esc(
      e.items.map((i) => `[${TYPE_LABEL[i.type] || i.type}] ${i.text}`).join('\n')
    )}</description></item>`
  )
  .join('\n')}
</channel></rss>`
);

// sitemap / robots
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages)
  .filter((p) => p !== '404.html')
  .map((p) => `<url><loc>${abs(p.replace(/index\.html$/, ''))}</loc><lastmod>${lastUpdate}</lastmod></url>`)
  .join('\n')}
</urlset>`
);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`);
write('.nojekyll', '');

const missingLogos = [...new Set(tools.filter((t) => !logoMap[t.logo]).map((t) => t.logo))];
console.log(`빌드 완료: 서비스 ${tools.length}개, 페이지 ${Object.keys(pages).length}개 → dist/`);
if (missingLogos.length) console.log(`로고 없음(${missingLogos.length}): ${missingLogos.join(', ')}  → npm run logos`);
