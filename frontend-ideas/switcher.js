/*
 * Панель-переключатель концептов frontend-ideas.
 * Подключение в начале HTML концепта: <script src="../switcher.js" defer></script>
 * Новый концепт добавьте в CONCEPTS ниже. Работает при открытии файлов локально
 * и на GitHub Pages (<base>/design/, см. .github/workflows/pages.yml);
 * в опубликованных артефактах скрипта нет, и панель просто не появляется.
 */
(function () {
  var CONCEPTS = [
    { n: '01', title: 'Лестница ставок', note: 'страница лота', href: 'https://claude.ai/artifact/Hg41si8MSFuxxBGsm9P7Jg' },
    { n: '02', title: 'Ближайший час торгов', note: 'главная', pages: [['index.html', 'Страница']] },
    { n: '04', title: 'Ящик стола', note: 'лендинг', pages: [['index.html', 'Страница']] },
    { n: '06', title: 'Лавка при дневном свете', note: 'лендинг', pages: [['index.html', 'Страница']] },
    { n: '08', title: 'Суконное поле', note: 'лендинг с баннером', pages: [['index.html', 'Страница']] },
    { n: '09', title: 'Суконное поле', note: 'главная с поиском', pages: [['index.html', 'Главная'], ['deals-variants.html', 'Топ сделок: варианты']] }
  ];

  if (window.__ideasSwitcher) return;
  window.__ideasSwitcher = true;
  window.__ideasConcepts = CONCEPTS; // для frontend-ideas/index.html

  var parts = decodeURIComponent(location.pathname).replace(/\\/g, '/').split('/');
  var file = parts.pop() || 'index.html';
  var dir = parts.pop();
  var curIdx = -1;
  CONCEPTS.forEach(function (c, i) { if (c.n === dir) curIdx = i; });
  var cur = CONCEPTS[curIdx];

  function hrefOf(c, page) {
    if (!c.pages) return c.href;
    return '../' + c.n + '/' + (page || c.pages[0][0]);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

  // previous / next concept that has a local page
  function step(dirn) {
    for (var i = curIdx + dirn; i >= 0 && i < CONCEPTS.length; i += dirn) if (CONCEPTS[i].pages) return CONCEPTS[i];
    return null;
  }
  var prev = step(-1), next = step(1);

  var css = [
    ':host{all:initial;display:block;position:relative;z-index:2147483000}',
    '*{box-sizing:border-box}',
    '[hidden]{display:none!important}',
    '.bar{display:flex;align-items:center;gap:6px;min-height:40px;padding:4px 12px;background:#15181F;color:#E9EBF0;font:500 13px/1.2 "Golos Text",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;overflow-x:auto;scrollbar-width:none}',
    '.bar::-webkit-scrollbar{display:none}',
    '.lbl{flex:none;margin-right:6px;color:#8A90A0;font-size:12px;letter-spacing:.04em}',
    'a,button{flex:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;text-decoration:none;cursor:pointer;white-space:nowrap}',
    'a:hover,button:hover{background:#262B36}',
    'a:focus-visible,button:focus-visible{outline:2px solid #F6D46A;outline-offset:1px}',
    '.num{font-weight:600;font-variant-numeric:tabular-nums}',
    '.c .t{display:none}',
    '.c[aria-current="page"]{background:#EDBA3A;color:#15181F}',
    '.c[aria-current="page"] .t{display:inline;font-weight:500}',
    '.c.ext .num::after{content:"↗";margin-left:3px;font-weight:400;opacity:.7}',
    '.sep{flex:none;width:1px;height:20px;margin:0 6px;background:#2F3542}',
    '.sub{color:#B9BECB}',
    '.sub[aria-current="page"]{background:#2F3542;color:#fff}',
    '.nav{color:#B9BECB;padding:0 9px}',
    '.nav[aria-disabled="true"]{opacity:.3;pointer-events:none}',
    '.sp{flex:1 0 8px}',
    '.hide{color:#8A90A0}',
    '.mini{position:fixed;left:10px;top:10px;height:30px;padding:0 10px;border-radius:999px;background:#15181F;color:#E9EBF0;font:600 12px/1 "Golos Text",system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
    '.mini:hover{background:#262B36}',
    '@media (max-width:640px){.lbl{display:none}.c[aria-current="page"] .t{display:none}}'
  ].join('\n');

  var html = '<nav class="bar" aria-label="Концепты frontend-ideas">' +
    '<span class="lbl">frontend-ideas</span>' +
    '<a class="nav" href="' + (prev ? hrefOf(prev) : '#') + '" aria-disabled="' + !prev + '" title="Предыдущий концепт (клавиша [)" aria-label="Предыдущий концепт">←</a>' +
    CONCEPTS.map(function (c) {
      var isCur = c === cur;
      return '<a class="c' + (c.pages ? '' : ' ext') + '" href="' + esc(hrefOf(c)) + '"' +
        (c.pages ? '' : ' target="_blank" rel="noopener"') +
        (isCur ? ' aria-current="page"' : '') +
        ' title="' + esc(c.n + ' · ' + c.title + ' — ' + c.note + (c.pages ? '' : ' (только артефакт)')) + '">' +
        '<span class="num">' + c.n + '</span><span class="t">' + esc(c.title) + '</span></a>';
    }).join('') +
    '<a class="nav" href="' + (next ? hrefOf(next) : '#') + '" aria-disabled="' + !next + '" title="Следующий концепт (клавиша ])" aria-label="Следующий концепт">→</a>' +
    (cur && cur.pages && cur.pages.length > 1 ? '<span class="sep" aria-hidden="true"></span>' + cur.pages.map(function (p) {
      return '<a class="sub" href="' + esc(hrefOf(cur, p[0])) + '"' + (p[0] === file ? ' aria-current="page"' : '') + '>' + esc(p[1]) + '</a>';
    }).join('') : '') +
    '<span class="sp"></span><button class="hide" type="button" title="Свернуть панель">Свернуть</button>' +
    '</nav><button class="mini" type="button" hidden title="Показать панель концептов">' + (cur ? cur.n : 'ideas') + ' ▾</button>';

  function mount() {
    var host = document.createElement('div');
    host.setAttribute('data-ideas-switcher', '');
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + css + '</style>' + html;
    document.body.insertBefore(host, document.body.firstChild);

    var bar = root.querySelector('.bar'), mini = root.querySelector('.mini');
    function setHidden(h) {
      bar.hidden = h; mini.hidden = !h;
      try { localStorage.setItem('ideas-switcher-hidden', h ? '1' : '0'); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem('ideas-switcher-hidden'); } catch (e) {}
    if (saved === '1') setHidden(true);
    root.querySelector('.hide').addEventListener('click', function () { setHidden(true); });
    mini.addEventListener('click', function () { setHidden(false); });

    // keep the current concept visible when the bar scrolls on narrow screens
    var curEl = root.querySelector('.c[aria-current="page"]');
    if (curEl && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = curEl.offsetLeft - bar.clientWidth / 2;

    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '[' && prev) { e.preventDefault(); location.href = hrefOf(prev); }
      if (e.key === ']' && next) { e.preventDefault(); location.href = hrefOf(next); }
    });
  }

  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
