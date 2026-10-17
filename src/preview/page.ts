/**
 * Página do índice de cenas: HTML/CSS/JS puros, sem build e sem CDN. O estado chega por SSE (`/events`)
 * e os cartões são atualizados no lugar, para o vídeo em loop não reiniciar a cada evento.
 * (String.raw: o script abaixo não pode usar crase nem cifrão-chave.)
 */
const PAGE = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visor de cenas · MChiodi Editor</title>
<style>
:root {
  --paper: #f8f8f2; --surface: #ffffff; --ink: #111827; --muted: #475569; --faint: #94a3b8;
  --line: rgba(15,23,42,0.09); --coral: #ff5555; --coral-deep: #ca3434; --emerald: #059669; --emerald-dot: #34d399;
  --amber: #b45309; --amber-dot: #f59e0b; --rose: #be123c; --rose-bg: #fff1f2;
  --shadow: 0 18px 35px -20px rgba(15,23,42,0.35); --shadow-raised: 0 30px 70px -30px rgba(15,23,42,0.5);
  --serif: "Playfair Display", "Iowan Old Style", Georgia, "Times New Roman", serif;
  --sans: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0c0c0c; --surface: #17181c; --ink: #f8f8f2; --muted: #a8b1c0; --faint: #6b7686;
    --line: rgba(248,248,242,0.1); --emerald: #34d399; --amber: #fbbf24; --rose: #fda4af; --rose-bg: rgba(190,18,60,0.18);
    --shadow: 0 18px 35px -20px rgba(0,0,0,0.9); --shadow-raised: 0 30px 70px -30px rgba(0,0,0,1);
  }
}
* { box-sizing: border-box; }
html { background: var(--paper); }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1480px; margin: 0 auto; padding: 40px 32px 80px; }
.eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
header.top { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
h1 { font-family: var(--serif); font-weight: 600; font-size: 48px; line-height: 1.05; margin: 10px 0 0; letter-spacing: -0.01em; }
h1 em { color: var(--coral); font-style: italic; }
.top-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.conn { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--faint); flex: none; }
.conn.on .dot { background: var(--emerald-dot); box-shadow: 0 0 0 4px rgba(52,211,153,0.2); }
.btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 13px var(--sans); padding: 9px 18px; border-radius: 9999px; cursor: pointer; text-decoration: none; box-shadow: var(--shadow); transition: transform .15s ease; }
.btn:hover { transform: translateY(-1px); }
.btn:focus-visible, .chip:focus-visible { outline: 2px solid var(--coral); outline-offset: 2px; }
.btn.primary { background: var(--ink); color: var(--paper); border-color: transparent; }
.btn.small { padding: 6px 14px; font-size: 12px; box-shadow: none; }
.summary { display: flex; align-items: stretch; gap: 16px; margin: 32px 0 20px; flex-wrap: wrap; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 16px 24px; min-width: 132px; box-shadow: var(--shadow); }
.stat b { display: block; font-family: var(--serif); font-weight: 600; font-size: 34px; line-height: 1.1; }
.stat span { font-size: 12px; color: var(--muted); }
.stat.err.has b { color: var(--rose); }
.now { flex: 1; min-width: 280px; background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 16px 24px; box-shadow: var(--shadow); display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.now p { margin: 0; font-size: 16px; font-weight: 500; }
.now.paused p { color: var(--amber); }
.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 26px; }
.chip { border: 1px solid var(--line); background: transparent; color: var(--muted); font: 500 13px var(--sans); padding: 7px 16px; border-radius: 9999px; cursor: pointer; }
.chip.on { background: var(--ink); color: var(--paper); border-color: transparent; }
.chip i { font-style: normal; opacity: 0.6; margin-left: 6px; }
.reel { font-size: 13px; color: var(--muted); margin-left: auto; }
.reel a { color: var(--ink); font-weight: 600; text-underline-offset: 3px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 24px; }
.card { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 24px; overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; }
.card.fresh { animation: fresh 9s ease-out forwards; }
@keyframes fresh { 0%, 35% { box-shadow: 0 0 0 3px var(--coral), var(--shadow-raised); } 100% { box-shadow: 0 0 0 3px rgba(255,85,85,0), var(--shadow); } }
.badge-new { position: absolute; top: 14px; left: 14px; z-index: 2; background: var(--coral); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; animation: fade 9s ease-out forwards; pointer-events: none; }
@keyframes fade { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
.media { position: relative; display: block; aspect-ratio: 16 / 9; background: linear-gradient(135deg, rgba(157,255,206,0.28), rgba(124,147,255,0.18) 55%, rgba(255,184,108,0.25)); border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; overflow: hidden; }
.media video, .media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.media.stale video, .media.stale img { opacity: 0.55; }
.media .ph { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.media .ph b { font-family: var(--serif); font-size: 56px; font-weight: 600; line-height: 1; color: var(--ink); opacity: 0.85; }
.media .ph span { font-size: 12px; color: var(--muted); }
.media .play { position: absolute; right: 12px; bottom: 12px; background: rgba(15,23,42,0.78); color: #fff; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 9999px; opacity: 0; transition: opacity .15s ease; }
.media:hover .play, .media:focus-visible .play { opacity: 1; }
.body { padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--muted); }
.status.ready, .status.live { color: var(--emerald); } .status.ready .dot, .status.live .dot { background: var(--emerald-dot); }
.status.rendering { color: var(--amber); } .status.rendering .dot { background: var(--amber-dot); animation: pulse 1.2s ease-in-out infinite; }
.status.error { color: var(--rose); } .status.error .dot { background: var(--rose); }
@keyframes pulse { 50% { opacity: 0.35; } }
.card h2 { font-family: var(--serif); font-weight: 600; font-size: 24px; line-height: 1.15; margin: 2px 0 0; overflow-wrap: anywhere; }
.meta { font-size: 12.5px; color: var(--muted); }
.extra { display: flex; flex-direction: column; gap: 12px; }
.extra:empty { display: none; }
.bar { height: 6px; border-radius: 9999px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--coral); border-radius: inherit; transition: width .25s ease; }
.desc { margin: 0; font-size: 13.5px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.keys { display: flex; flex-wrap: wrap; gap: 6px; }
.keys code { font: 500 11.5px var(--mono); border: 1px solid var(--line); border-radius: 9999px; padding: 2px 10px; color: var(--muted); }
.error { margin: 0; background: var(--rose-bg); color: var(--rose); border-radius: 16px; padding: 12px 14px; font: 500 12px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 190px; overflow: auto; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 6px; }
.path { font: 500 11px var(--mono); color: var(--faint); overflow-wrap: anywhere; }
.empty { grid-column: 1 / -1; text-align: center; padding: 72px 20px; color: var(--muted); border: 1px dashed var(--line); border-radius: 24px; }
.empty b { display: block; font-family: var(--serif); font-size: 28px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
@media (max-width: 640px) { .wrap { padding: 24px 16px 60px; } h1 { font-size: 36px; } .reel { margin-left: 0; width: 100%; } }
@media (prefers-reduced-motion: reduce) { .card.fresh, .badge-new, .status.rendering .dot { animation: none; } .badge-new { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <div class="eyebrow">MChiodi Editor</div>
      <h1>Visor de <em>cenas</em></h1>
    </div>
    <div class="top-actions">
      <span class="conn" id="conn"><span class="dot"></span><span id="conn-text">conectando…</span></span>
      <a class="btn primary" id="studio" target="_blank" rel="noopener" hidden>Abrir o Studio</a>
    </div>
  </header>
  <section class="summary">
    <div class="stat"><b id="n-ready">0</b><span id="l-ready">prontas</span></div>
    <div class="stat"><b id="n-queued">0</b><span>na fila</span></div>
    <div class="stat err" id="s-error"><b id="n-error">0</b><span>com erro</span></div>
    <div class="now" id="now"><div class="eyebrow">Agora</div><p id="now-text">carregando…</p></div>
  </section>
  <nav class="filters" id="filters"></nav>
  <main class="grid" id="grid"></main>
</div>
<script>
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var filter = params.get('projeto') || params.get('project') || '';
  var state = null;
  var cards = {};
  var offset = 0;
  var loadedAt = Date.now();
  var STAGE = { bundle: 'empacotando', strip: 'tira de frames', video: 'prévia animada' };

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function ago(ms) {
    var s = Math.max(0, Math.round((Date.now() + offset - ms) / 1000));
    if (s < 10) return 'agora mesmo';
    if (s < 60) return 'há ' + s + ' s';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    return 'há ' + Math.round(s / 86400) + ' d';
  }
  function seconds(value) { return value == null ? '' : String(Math.round(value * 10) / 10).replace('.', ',') + ' s'; }
  function set(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
  function text(el, value) { if (el.textContent !== value) el.textContent = value; }

  function statusLabel(scene) {
    if (scene.status === 'queued') return ['queued', 'na fila'];
    if (scene.status === 'rendering') return ['rendering', 'renderizando · ' + (STAGE[scene.stage] || '') + ' ' + scene.percent + '%'];
    if (scene.status === 'error') return ['error', 'com erro'];
    return state.previews === 'off' ? ['live', 'ao vivo no Studio'] : ['ready', scene.stale ? 'pronta (versão anterior)' : 'pronta'];
  }

  function copy(value, button) {
    var done = function () { var old = button.textContent; button.textContent = 'copiado'; setTimeout(function () { button.textContent = old; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(value).then(done, fallback); } else { fallback(); }
    function fallback() {
      var area = document.createElement('textarea'); area.value = value; document.body.appendChild(area); area.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* sem área de transferência */ }
      area.remove();
    }
  }

  function buildMedia(card, scene) {
    var signature = (scene.video || '') + '|' + scene.strip.map(function (f) { return f.url; }).join(',') + '|' + (scene.studio || '');
    var media = card._media;
    media.classList.toggle('stale', !!scene.stale);
    if (media._signature === signature) return;
    media._signature = signature;
    if (card._slides) { clearInterval(card._slides); card._slides = null; }
    var inner = '';
    if (scene.video) {
      inner = '<video src="' + esc(scene.video) + '" muted loop autoplay playsinline preload="metadata"' + (scene.strip[2] ? ' poster="' + esc(scene.strip[2].url) + '"' : '') + '></video>';
    } else if (scene.strip.length) {
      inner = '<img alt="frames de ' + esc(scene.name) + '" src="' + esc(scene.strip[0].url) + '">';
    } else {
      inner = '<div class="ph"><b>' + esc(scene.name.charAt(0)) + '</b><span>' + (scene.studio ? 'toca ao vivo no Studio' : 'sem prévia ainda') + '</span></div>';
    }
    if (scene.studio) inner += '<span class="play">abrir no Studio</span>';
    media.innerHTML = inner;
    if (scene.studio) { media.href = scene.studio; media.target = '_blank'; media.rel = 'noopener'; } else { media.removeAttribute('href'); }
    if (!scene.video && scene.strip.length > 1) {
      // sem a prévia animada, a tira passa como um slideshow
      var img = media.querySelector('img'); var index = 0; var frames = scene.strip;
      card._slides = setInterval(function () { index = (index + 1) % frames.length; img.src = frames[index].url; }, 800);
    }
  }

  function createCard(scene) {
    var card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = '<a class="media"></a><div class="body"><div class="row"><span class="eyebrow p"></span><span class="status"></span></div><h2></h2><div class="meta"></div><div class="extra"></div><div class="actions"></div><div class="path"></div></div>';
    card._media = card.querySelector('.media');
    // só destaca o que nasceu com a página aberta, não o que já existia
    if (scene.addedAt && scene.addedAt > loadedAt + offset - 60000) {
      card.classList.add('fresh');
      var badge = document.createElement('span'); badge.className = 'badge-new'; badge.textContent = 'nova'; card.appendChild(badge);
    }
    card.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-copy]');
      if (button) copy(card._scene[button.getAttribute('data-copy')], button);
    });
    return card;
  }

  function updateCard(card, scene) {
    card._scene = scene;
    buildMedia(card, scene);
    var label = statusLabel(scene);
    text(card.querySelector('.p'), scene.project);
    var status = card.querySelector('.status');
    status.className = 'status ' + label[0];
    set(status, '<span class="dot"></span>' + esc(label[1]));
    text(card.querySelector('h2'), scene.name);
    text(card.querySelector('.meta'), [seconds(scene.durationSec), 'mudou ' + ago(scene.changedAt)].filter(Boolean).join(' · '));
    var extra = '';
    if (scene.status === 'rendering') extra += '<div class="bar"><i style="width:' + scene.percent + '%"></i></div>';
    if (scene.error) extra += '<pre class="error">' + esc(scene.error) + '</pre>';
    if (scene.description) extra += '<p class="desc" title="' + esc(scene.description) + '">' + esc(scene.description) + '</p>';
    if (scene.revealAt.length) extra += '<div class="keys" title="chaves de revealAt">' + scene.revealAt.map(function (k) { return '<code>' + esc(k) + '</code>'; }).join('') + '</div>';
    set(card.querySelector('.extra'), extra);
    set(card.querySelector('.actions'), (scene.studio ? '<a class="btn small primary" target="_blank" rel="noopener" href="' + esc(scene.studio) + '">Abrir no Studio</a>' : '') +
      '<button class="btn small" data-copy="edl" title="' + esc(scene.edl) + '">Copiar trecho da EDL</button><button class="btn small" data-copy="file">Copiar caminho</button>');
    text(card.querySelector('.path'), scene.file);
  }

  function renderFilters() {
    var total = state.scenes.length;
    var html = '<button class="chip' + (filter ? '' : ' on') + '" data-p="">Todos<i>' + total + '</i></button>';
    var reel = '';
    state.projects.forEach(function (p) {
      html += '<button class="chip' + (filter === p.slug ? ' on' : '') + '" data-p="' + esc(p.slug) + '">' + esc(p.slug) + '<i>' + p.scenes + '</i></button>';
      if (p.reel && (filter === p.slug || (!filter && state.projects.length === 1))) reel = '<span class="reel">Ver todas em sequência: <a target="_blank" rel="noopener" href="' + esc(p.reel) + '">Roteiro-' + esc(p.slug) + '</a></span>';
    });
    if (filter && !state.projects.some(function (p) { return p.slug === filter; })) html += '<button class="chip on" data-p="' + esc(filter) + '">' + esc(filter) + '<i>0</i></button>';
    set($('filters'), html + reel);
  }

  function renderSummary() {
    var visible = state.scenes.filter(function (s) { return !filter || s.project === filter; });
    var count = function (status) { return visible.filter(function (s) { return s.status === status; }).length; };
    text($('n-ready'), String(count('ready')));
    text($('l-ready'), state.previews === 'off' ? 'cenas' : 'prontas');
    text($('n-queued'), String(count('queued') + count('rendering')));
    text($('n-error'), String(count('error')));
    $('s-error').classList.toggle('has', count('error') > 0);
    var q = state.queue; var now = $('now'); var message;
    now.classList.toggle('paused', !!q.paused);
    if (q.paused) message = 'Em pausa: ' + q.paused;
    else if (q.current) message = 'Renderizando ' + q.current.key + ' — ' + (STAGE[q.current.stage] || '') + ' ' + q.current.percent + '%';
    else if (state.previews === 'off') message = 'Observando motion/src/scenes — cena nova entra aqui e no Studio sozinha';
    else message = 'Fila vazia — esperando mudanças nas cenas';
    text($('now-text'), message);
    var studio = $('studio');
    if (state.studioUrl) { studio.hidden = false; studio.href = state.studioUrl; } else { studio.hidden = true; }
  }

  function renderGrid() {
    var grid = $('grid');
    var visible = state.scenes.filter(function (s) { return !filter || s.project === filter; });
    var keep = {};
    visible.forEach(function (scene) {
      keep[scene.key] = true;
      if (!cards[scene.key]) cards[scene.key] = createCard(scene);
      updateCard(cards[scene.key], scene);
    });
    Object.keys(cards).forEach(function (key) {
      if (keep[key]) return;
      if (cards[key]._slides) clearInterval(cards[key]._slides);
      cards[key].remove(); delete cards[key];
    });
    var empty = grid.querySelector('.empty');
    if (!visible.length) {
      if (!empty) { empty = document.createElement('div'); empty.className = 'empty'; grid.appendChild(empty); }
      set(empty, '<b>Nenhuma cena ainda</b>' + (filter ? 'Quando o agente gravar a primeira cena de ' + esc(filter) + ', ela aparece aqui sozinha.' : 'Quando o agente gravar a primeira cena, ela aparece aqui sozinha.'));
      return;
    }
    if (empty) empty.remove();
    // só mexe na ordem quando ela mudou: reinserir um vídeo tocando o reinicia
    var current = Array.prototype.map.call(grid.children, function (el) { return el._scene ? el._scene.key : ''; }).join('|');
    var wanted = visible.map(function (s) { return s.key; }).join('|');
    if (current !== wanted) visible.forEach(function (scene) { grid.appendChild(cards[scene.key]); });
  }

  function apply(next) {
    state = next;
    offset = next.now - Date.now();
    renderFilters(); renderSummary(); renderGrid();
  }

  function live(on) { $('conn').classList.toggle('on', on); text($('conn-text'), on ? 'ao vivo' : 'reconectando…'); }

  function connect() {
    var source = new EventSource('/events');
    source.addEventListener('state', function (event) { live(true); apply(JSON.parse(event.data)); });
    source.onerror = function () {
      live(false);
      // servidor reiniciando: o EventSource desiste em alguns casos, então recria
      if (source.readyState === 2) { source.close(); setTimeout(connect, 1500); }
    };
  }

  $('filters').addEventListener('click', function (event) {
    var chip = event.target.closest('button[data-p]');
    if (!chip || !state) return;
    filter = chip.getAttribute('data-p');
    var url = new URL(location.href); url.searchParams.delete('project');
    if (filter) url.searchParams.set('projeto', filter); else url.searchParams.delete('projeto');
    history.replaceState(null, '', url);
    apply(state);
  });
  setInterval(function () { if (state) renderGrid(); }, 15000);
  connect();
})();
</script>
</body>
</html>
`;

export function renderPage(): string {
  return PAGE;
}
