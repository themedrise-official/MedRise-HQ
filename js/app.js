import { T } from './i18n.js';
import * as S from './store.js';
import { render, TEMPLATES } from './templates.js';
import { buildBundle, downloadBundle } from './bundle.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const st = {
  page: 'home', open: null, out: '', month: new Date(), prompt: null,
  lang: localStorage.getItem('mr-lang') || 'hi',
  theme: localStorage.getItem('mr-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
};
const t = (k) => T[st.lang][k] ?? k;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const STAT = { done: 'd', progress: 'p', pending: 'w' };
const LBL = () => ({ done: t('done'), progress: t('prog'), pending: t('pend') });

const itemBtn = (i) => `<button class="item" data-act="open" data-id="${esc(i.id)}"><b>${esc(i.title)}</b><span class="mu">${esc(i.template)}${i.schedule ? ' | ' + esc(i.schedule.date) + ' ' + esc(i.schedule.time || '') : ''}</span></button>`;

function home(a) {
  const n = (s) => a.filter((i) => i.status === s).length;
  const L = LBL();
  return `<section class="hero"><div><h1>${t('h1')}</h1><p>${t('sub')}</p><div class="row"><button class="btn" data-act="nav" data-p="dash">${t('open')}</button></div></div><img src="icons/icon-512.png" alt="MedRise HQ"></section>
<div class="grid">${['done', 'progress', 'pending'].map((s) => `<button class="card stat" data-act="nav" data-p="dash"><span class="mu">${L[s]}</span><b class="${STAT[s]}">${n(s)}</b></button>`).join('')}</div>
<h2>${t('how')}</h2><div class="grid"><div class="card">1. ${t('how1')}</div><div class="card">2. ${t('how2')}</div><div class="card">3. ${t('how3')}</div></div>`;
}

function dash(a) {
  const L = LBL();
  return `<h2 style="margin-top:0">${t('dash')}</h2>
<form class="cmd" id="cmd"><input id="cmdin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('cmdPh'))}" aria-label="${t('cmd')}"><button class="btn" type="submit">OK</button></form>
<div class="mu" style="margin-top:6px">${esc(t('cmdHelp'))}</div>${st.out ? `<div class="out">${esc(st.out)}</div>` : ''}
<div class="grid" style="margin-top:20px">${['done', 'progress', 'pending'].map((s) => {
    const l = a.filter((i) => i.status === s);
    return `<div class="card"><h3 class="${STAT[s]}">${L[s]} (${l.length})</h3>${l.map(itemBtn).join('') || `<span class="mu">${t('empty')}</span>`}</div>`;
  }).join('')}</div>`;
}

function calendar(a) {
  const m = st.month, y = m.getFullYear(), mo = m.getMonth(), today = iso(new Date());
  const first = new Date(y, mo, 1), pad = (first.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
  const wd = st.lang === 'hi' ? ['Som', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Ravi'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let cells = wd.map((d) => `<div class="h">${d}</div>`).join('') + '<div></div>'.repeat(pad);
  for (let d = 1; d <= days; d++) {
    const k = iso(new Date(y, mo, d));
    const its = a.filter((i) => i.schedule?.date === k);
    cells += `<div class="c ${k === today ? 't' : ''}"><span>${d}</span>${its.map((i) => `<button class="chip" data-act="open" data-id="${esc(i.id)}" title="${esc(i.title)}">${esc((i.schedule.time || '') + ' ' + i.title)}</button>`).join('')}</div>`;
  }
  const un = a.filter((i) => !i.schedule && i.status !== 'done');
  return `<div class="bar"><button class="ghost" data-act="mprev" aria-label="Previous month">&lt;</button><h2 style="margin:0">${m.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><button class="ghost" data-act="mnext" aria-label="Next month">&gt;</button></div>
<div class="cal">${cells}</div><h2>${t('unsched')}</h2><div class="grid">${un.map(itemBtn).join('') || `<span class="mu">${t('empty')}</span>`}</div>`;
}

function imp() {
  return `<h2 style="margin-top:0">${t('impT')}</h2><p class="mu" style="margin-bottom:12px">${t('impH')} (${t('local')})</p>
<div class="bar"><input type="file" id="file" accept=".json,application/json" aria-label="JSON file"><button class="ghost" data-act="export">${t('exp')}</button></div>
<textarea id="paste" placeholder="${esc(t('paste'))}" aria-label="${esc(t('paste'))}"></textarea>
<div class="row" style="margin-top:12px"><button class="btn" data-act="import">${t('run')}</button></div>${st.out ? `<div class="out">${esc(st.out)}</div>` : ''}`;
}

function viewer() {
  const i = S.get(st.open);
  if (!i) return '';
  const L = LBL();
  const html = TEMPLATES[i.template] ? ((i.sections && i.sections.length) || (i.questions && i.questions.length) ? render(i) : `<p class="mu">${t('pendingMsg')}</p>`) : `<p class="mu">${t('noTpl')} ${esc(i.template)}</p>`;
  return `<div class="bar"><button class="ghost" data-act="back">${t('back')}</button>
<select data-chg="status" data-id="${esc(i.id)}" aria-label="Status">${Object.keys(L).map((s) => `<option value="${s}" ${s === i.status ? 'selected' : ''}>${L[s]}</option>`).join('')}</select>
<input type="date" data-chg="date" data-id="${esc(i.id)}" value="${esc(i.schedule?.date || '')}" aria-label="Date"><input type="time" data-chg="time" data-id="${esc(i.id)}" value="${esc(i.schedule?.time || '')}" aria-label="Time">
<button class="btn" data-act="print">${t('print')}</button>${S.isApproved(i) ? `<button class="ghost" data-act="bundle" data-id="${esc(i.id)}">Studio bundle</button>` : ''}${i._remote ? '' : `<button class="ghost" data-act="del" data-id="${esc(i.id)}">${t('del')}</button>`}</div>
<div class="stage">${html}</div>`;
}

function paint() {
  document.documentElement.dataset.theme = st.theme;
  document.documentElement.lang = st.lang === 'hi' ? 'hi-Latn' : 'en';
  const a = S.items();
  $('#nav').innerHTML = ['home', 'dash', 'cal', 'imp'].map((p) => `<button data-act="nav" data-p="${p}" ${st.page === p && !st.open ? 'aria-current="page"' : ''}>${t(p)}</button>`).join('');
  $('#lang').textContent = t('lang');
  $('#theme').textContent = st.theme === 'dark' ? t('light') : t('dark');
  const ib = $('#inst');
  const ios = /iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone;
  ib.hidden = !(st.prompt || ios);
  ib.textContent = t('install');
  $('#app').innerHTML = st.open ? viewer() : { home, dash, cal: calendar, imp }[st.page](a);
}

function run(line) {
  const a = (line.trim().match(/"[^"]+"|\S+/g) || []).map((x) => x.replace(/^"|"$/g, ''));
  const [c, ...r] = a;
  const L = LBL();
  const dt = (x) => (x === 'today' ? iso(new Date()) : x === 'tomorrow' ? iso(new Date(Date.now() + 864e5)) : x);
  if (c === 'list') return S.items().map((i) => `${i.id}  [${L[i.status]}]  ${i.title}`).join('\n') || t('empty');
  if (c === 'export') { S.exportAll(); return t('ok'); }
  const it = r[0] ? S.find(r[0]) : null;
  if (['status', 'schedule', 'open'].includes(c) && !it) return `${t('nf')} ${r[0] || ''}`;
  if (c === 'open') { st.open = it.id; return ''; }
  if (c === 'status' && ['done', 'progress', 'pending'].includes(r[1])) { S.patch(it.id, { status: r[1] }); return t('ok'); }
  if (c === 'schedule' && /^\d{4}-\d\d-\d\d$|^today$|^tomorrow$/.test(r[1] || '')) { S.patch(it.id, { schedule: { date: dt(r[1]), time: r[2] || '' } }); return t('ok'); }
  return t('cmdHelp');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === 'nav') { st.page = b.dataset.p; st.open = null; st.out = ''; }
  else if (act === 'lang') { st.lang = st.lang === 'hi' ? 'en' : 'hi'; localStorage.setItem('mr-lang', st.lang); }
  else if (act === 'theme') { st.theme = st.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('mr-theme', st.theme); }
  else if (act === 'open') st.open = id;
  else if (act === 'back') st.open = null;
  else if (act === 'print') { window.print(); return; }
  else if (act === 'bundle') {
    const it = S.repoItem(id); // export the repository item itself, never a local copy or override
    if (!it || !S.isApproved(it)) { alert('Not approved for Studio handoff.'); return; }
    buildBundle(it).then(downloadBundle).catch((x) => alert('Bundle export failed: ' + x.message));
    return;
  }
  else if (act === 'del') { S.remove(id); st.open = null; }
  else if (act === 'mprev') st.month = new Date(st.month.getFullYear(), st.month.getMonth() - 1, 1);
  else if (act === 'mnext') st.month = new Date(st.month.getFullYear(), st.month.getMonth() + 1, 1);
  else if (act === 'export') { S.exportAll(); return; }
  else if (act === 'import') {
    try { const r = S.importText($('#paste').value); st.out = `${t('ok')} imported ${r.imported}, skipped ${r.skipped} (already exist), rejected ${r.rejected}${r.skipped ? ': ' + r.skippedIds.slice(0, 5).join(', ') : ''}`; } catch (x) { st.out = `${t('err')} ${x.message}`; }
  } else if (act === 'install') {
    if (st.prompt) { st.prompt.prompt(); st.prompt = null; } else alert(t('ios'));
  }
  paint();
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'file' && el.files[0]) { $('#paste').value = await el.files[0].text(); return; }
  const k = el.dataset.chg;
  if (!k) return;
  const i = S.get(el.dataset.id);
  if (k === 'status') S.patch(i.id, { status: el.value });
  else S.patch(i.id, { schedule: el.value || k === 'time' ? { date: k === 'date' ? el.value : i.schedule?.date || '', time: k === 'time' ? el.value : i.schedule?.time || '' } : null });
  paint();
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'cmd') return;
  e.preventDefault();
  st.out = run($('#cmdin').value);
  paint();
});

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); st.prompt = e; paint(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
S.load().then(paint);
paint();
