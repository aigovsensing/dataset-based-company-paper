import { normalize, search, dedupe, classifyVenue } from './lib.js';
const $ = (id) => document.getElementById(id);
const { t, pick } = window.I18N;
const errText = (e) => (e.i18n ? pick(e.i18n) : e.message);
let statusFn = () => '', lastLogs = [], lastRes = null;
const setStatus = (fn) => { statusFn = fn; $('status').textContent = fn(); };
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let page = 1, query = '';
let companies = [], selected = new Set(), editing = null, results = [];

async function defaults() { return normalize(await (await fetch('data/major-company-list.json')).json()); }
function persist() { store.set('companies', JSON.stringify(companies)); }
async function init() {
  $('fromYear').value = new Date().getFullYear() - 3;
  $('apiKey').value = store.get('apiKey') || '';
  try { companies = normalize(JSON.parse(store.get('companies'))); } catch { companies = await defaults(); }
  selected = new Set(companies.map((c) => c.name)); render();
}
function render() {
  $('compCount').textContent = `(${selected.size}/${companies.length})`;
  $('companies').innerHTML = companies.map((c) => `<span class="chip" title="${esc(c.aliases.join(', '))}"><label class="inline"><input type="checkbox" data-n="${esc(c.name)}" ${selected.has(c.name) ? 'checked' : ''}> ${esc(c.name)}</label><button data-edit="${esc(c.name)}" title="${esc(t('edit'))}">✎</button><button data-del="${esc(c.name)}" title="${esc(t('del'))}">✕</button></span>`).join('');
}
$('companies').addEventListener('click', (e) => {
  const el = e.target;
  if (el.dataset.del) { if (!confirm(t('confirmDel', { name: el.dataset.del }))) return; companies = companies.filter((c) => c.name !== el.dataset.del); selected.delete(el.dataset.del); persist(); }
  else if (el.dataset.edit) { const c = companies.find((x) => x.name === el.dataset.edit); editing = c.name; $('cName').value = c.name; $('cAliases').value = c.aliases.join(', '); $('cSave').textContent = t('edit'); $('cCancel').hidden = false; return; }
  else if (el.dataset.n) el.checked ? selected.add(el.dataset.n) : selected.delete(el.dataset.n);
  render();
});
const resetForm = () => { editing = null; $('compForm').reset(); $('cSave').textContent = t('add'); $('cCancel').hidden = true; };
$('cCancel').onclick = resetForm;
$('compForm').onsubmit = (e) => {
  e.preventDefault();
  const c = { name: $('cName').value.trim(), aliases: $('cAliases').value.split(',').map((s) => s.trim()).filter(Boolean) };
  try {
    companies = normalize(editing ? companies.map((x) => (x.name === editing ? c : x)) : [...companies, c]);
    if (editing && selected.delete(editing)) selected.add(c.name); else if (!editing) selected.add(c.name);
    persist(); resetForm(); render();
  } catch (err) { alert(errText(err)); }
};
$('selAll').onclick = () => { selected = new Set(companies.map((c) => c.name)); render(); };
$('selNone').onclick = () => { selected.clear(); render(); };
$('reset').onclick = async () => { companies = await defaults(); selected = new Set(companies.map((c) => c.name)); persist(); render(); };
$('exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(companies, null, 2) + '\n'], { type: 'application/json' })); a.download = 'major-company-list.json'; a.click(); };
$('imp').onclick = () => $('impFile').click();
$('impFile').onchange = async (e) => { try { companies = normalize(JSON.parse(await e.target.files[0].text())); selected = new Set(companies.map((c) => c.name)); persist(); render(); } catch (err) { alert(t('importFail', { msg: errText(err) })); } };

const venueLabel = (r) => `${r.venueInfo.abbr} (${r.year})`;
const claim = (r) => {
  const co = r.companies.join(', ');
  return `* ${t('claimVenue')}: ${venueLabel(r)}\n   * ${t('claimNote')}\n* ${t('claimTitle')}: ${r.title} (${r.year})\n* ${t('claimCompany')}: ${co}\n* ${t('claimLink')}: ${r.url}\n* ${t('claimDataset')}: ${r.dataset}\n* ${t('claimUsage')}: ${t('claimUsageDocs', { ds: r.dataset })}`;
};

$('go').onclick = async () => {
  const missing = ['fromYear', 'dsName', 'dsUrl'].find((id) => !$(id).value.trim());
  if (missing) { $(missing).focus(); setStatus(() => t('needRequired')); return; }
  const ref = $('dsRef').value.trim(); const key = $('apiKey').value.trim(); store.set('apiKey', key);
  $('go').disabled = true; $('resultCard').hidden = true; $('bar').hidden = false; $('log').hidden = false; lastLogs = []; renderLog(); setStatus(() => t('running'));
  const log = (m) => { lastLogs.push(m); renderLog(); };
  try {
    if (!selected.size) throw new Error(t('needCompany'));
    const dataset = { name: $('dsName').value.trim(), url: $('dsUrl').value.trim(), refArxiv: ref };
    const r = await search({ fromYear: Number($('fromYear').value), companies: companies.filter((c) => selected.has(c.name)), dataset, apiKey: key, log, progress: (p) => ($('bar').firstElementChild.style.width = `${Math.round(p * 100)}%`) });
    page = 1;
    results = dedupe(r.results.map((x) => ({ ...x, venueInfo: classifyVenue(x.venue) })));
    lastRes = { source: 'OpenAlex', scanned: r.scanned, fromYear: $('fromYear').value, reference: r.reference, keywords: r.keywords }; renderMeta();
    rows(); $('resultCard').hidden = false; setStatus(() => t('done'));
  } catch (err) { setStatus(() => t('errorPrefix', { msg: errText(err) })); }
  $('go').disabled = false;
};
function renderLog() { $('log').textContent = lastLogs.map(pick).join('\n'); $('log').scrollTop = 1e9; }
function renderMeta() {
  if (!lastRes) return;
  const r = lastRes;
  $('meta').textContent = [t('metaSource', { src: r.source }), t('metaScanned', { n: r.scanned }), t('metaSince', { y: r.fromYear }), t('metaNewest'), t('metaRef', { title: r.reference.title + (r.reference.arxiv ? ` (arXiv:${r.reference.arxiv})` : '') }), t('metaKw', { kw: r.keywords.join(', ') })].join(' · ');
}
function rows() {
  const all = filtered(), size = Number($('pageSize').value) || 20;
  const pages = Math.max(1, Math.ceil(all.length / size)); page = Math.min(page, pages);
  const start = (page - 1) * size, list = all.slice(start, start + size);
  $('resCount').textContent = query || $('onlyOfficial').checked ? t('countFiltered', { n: all.length, total: results.length }) : t('countAll', { n: all.length });
  renderPager(pages);
  $('rows').innerHTML = list.map((r, i) => `<tr><td class="no">${all.length - start - i}</td><td>${esc(venueLabel(r))}${r.venueInfo.official ? (r.venueInfo.abbr !== r.venueInfo.name ? `<br><small>${esc(r.venueInfo.name)}</small>` : '') : `<br><span class="badge">${esc(t('notOfficial'))}</span>`}</td>
  <td>${esc(r.title)} (${esc(r.year)})</td><td>${esc(r.companies.join(', '))}</td>
  <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>${r.publishedUrl !== r.url ? `<br><a href="${esc(r.publishedUrl)}" target="_blank" rel="noopener">${esc(t('publishedLink'))}</a>` : ''}</td>
  <td>${esc(r.dataset)}</td><td><span class="badge">${esc(t('usageDocs'))}</span></td><td><button data-copy="${results.indexOf(r)}">${esc(t('copy'))}</button></td></tr>`).join('') || `<tr><td colspan="8">${esc(t('none'))}</td></tr>`;
}

function filtered() {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return results.filter((r) => {
    if ($('onlyOfficial').checked && !r.venueInfo.official) return false;
    if (!terms.length) return true;
    const hay = [r.title, r.year, r.companies.join(' '), r.venueInfo.abbr, r.venueInfo.name, r.url, r.dataset, ...(r.evidence?.snippets || [])].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
function renderPager(pages) {
  const btn = (label, p, { cur, dis } = {}) => `<button data-page="${p}" ${cur ? 'class="cur"' : ''} ${dis ? 'disabled' : ''}>${label}</button>`;
  const from = Math.max(1, Math.min(page - 2, pages - 4)), to = Math.min(pages, from + 4);
  let h = btn('«', 1, { dis: page === 1 }) + btn('‹', page - 1, { dis: page === 1 });
  for (let p = from; p <= to; p++) h += btn(p, p, { cur: p === page });
  h += btn('›', page + 1, { dis: page === pages }) + btn('»', pages, { dis: page === pages });
  $('pager').innerHTML = pages > 1 ? h + `<span class="sub">&nbsp;${esc(t('pageOf', { p: page, n: pages }))}</span>` : '';
}
$('pager').addEventListener('click', (e) => { const p = Number(e.target.dataset.page); if (p) { page = p; rows(); $('rows').closest('.scroll').scrollIntoView({ block: 'start' }); } });
$('pageSize').onchange = () => { page = 1; rows(); };
let qTimer; $('q').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { query = e.target.value.trim(); page = 1; rows(); }, 200); };
$('qClear').onclick = () => { $('q').value = ''; query = ''; page = 1; rows(); };
$('onlyOfficial').onchange = rows;
$('rows').addEventListener('click', async (e) => { const i = e.target.dataset.copy; if (i == null) return; await navigator.clipboard.writeText(claim(results[i])); e.target.textContent = t('copied'); setTimeout(() => (e.target.textContent = t('copy')), 1500); });
$('csv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rs = [['venue', 'year', 'title', 'companies', 'url', 'dataset'], ...results.map((r) => [venueLabel(r), r.year, r.title, r.companies.join('; '), r.url, r.dataset])];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rs.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'papers.csv'; a.click();
};
I18N.onChange(() => {
  render(); $('cSave').textContent = editing ? t('edit') : t('add');
  $('status').textContent = statusFn(); renderLog(); renderMeta();
  if (results.length) rows();
});
init();
