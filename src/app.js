// 목록 검색·필터 (홈, 카테고리, 모델별 페이지)
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
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== q) {
      e.preventDefault();
      q.focus();
    }
  });
})();
