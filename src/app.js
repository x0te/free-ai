// ── 테마: 기본은 시스템 설정, 버튼으로 라이트/다크 고정 (localStorage) ──
const root = document.documentElement;
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

function syncGiscus() {
  const frame = document.querySelector('iframe.giscus-frame');
  frame?.contentWindow.postMessage({ giscus: { setConfig: { theme: currentTheme() } } }, 'https://giscus.app');
}

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
  syncGiscus();
});
darkQuery.addEventListener('change', syncGiscus);

// ── 댓글(giscus): 현재 테마로 로드 ──
const slot = document.querySelector('.giscus-slot');
if (slot) {
  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  for (const [k, v] of Object.entries(slot.dataset)) s.setAttribute('data-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v);
  s.setAttribute('data-theme', currentTheme());
  slot.replaceWith(s);
}

// ── 목록 검색·필터·정렬 (홈, 카테고리, 모델별 페이지) ──
(() => {
  const q = document.getElementById('q');
  if (!q) return;
  const empty = document.getElementById('empty');
  const items = [...document.querySelectorAll('.row[data-q], .model-item[data-q]')];
  const boards = [...document.querySelectorAll('[data-board]')];
  const chips = [...document.querySelectorAll('.chip[data-f]')];
  const active = new Set();

  function apply() {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const el of items) {
      const text = el.dataset.q;
      const flags = (el.dataset.flags || '').split(' ');
      el.hidden = !(terms.every((t) => text.includes(t)) && [...active].every((f) => flags.includes(f)));
    }
    let any = false;
    for (const b of boards) {
      const visible = b.querySelector('.row[data-q]:not([hidden]), .model-item[data-q]:not([hidden])');
      b.hidden = !visible;
      any ||= !!visible;
    }
    if (empty) empty.hidden = any;
  }

  q.addEventListener('input', apply);
  for (const c of chips) {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', () => {
      const f = c.dataset.f;
      active.has(f) ? active.delete(f) : active.add(f);
      c.setAttribute('aria-pressed', String(active.has(f)));
      apply();
    });
  }

  // 인기순(화제성) ↔ 최신순(마지막 변경일)
  const sortButtons = [...document.querySelectorAll('[data-sort]')];
  for (const btn of sortButtons) {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.sort;
      for (const b of sortButtons) b.setAttribute('aria-pressed', String(b === btn));
      for (const list of document.querySelectorAll('.board .rows')) {
        const rows = [...list.children];
        rows.sort((a, b) =>
          mode === 'new'
            ? (a.dataset.score < 0) - (b.dataset.score < 0) || b.dataset.updated.localeCompare(a.dataset.updated) || b.dataset.score - a.dataset.score
            : b.dataset.score - a.dataset.score
        );
        list.append(...rows);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== q) {
      e.preventDefault();
      q.focus();
    }
  });
})();
