const $ = (id) => document.getElementById(id);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const { t, pick } = I18N;
// 서버 오류는 {ko,en} 객체일 수 있다 → 표시 시점의 언어로 변환
const apiError = (m, fallback) => Object.assign(new Error(typeof m === 'string' ? m : pick(m) || fallback), { i18n: typeof m === 'object' ? m : null });
const errText = (e) => (e.i18n ? pick(e.i18n) : e.message);
const api = async (url, opt) => {
  const r = await fetch(url, opt && { ...opt, headers: { 'Content-Type': 'application/json' }, body: opt.body && JSON.stringify(opt.body) });
  const j = await r.json();
  if (!r.ok) throw apiError(j.error, r.statusText);
  return j;
};
let statusFn = () => '', lastLogs = [], lastRes = null;
const setStatus = (fn) => { statusFn = fn; $('status').textContent = fn(); };

let page = 1, query = '';
let companies = [], selected = new Set(), editing = null, results = [], dataset = {};

async function init() {
  const cfg = await api('/api/config');
  dataset = cfg.dataset;
  // 기본값: 올해 - 3년 (브라우저 시계 기준으로 자동 계산)
  $('fromYear').value = new Date().getFullYear() - 3;
  $('dsName').value = dataset.name; $('dsUrl').value = dataset.url;
  companies = await api('/api/companies');
  selected = new Set(companies.map((c) => c.name));
  renderCompanies();
}

function renderCompanies() {
  $('compCount').textContent = `(${selected.size}/${companies.length})`;
  $('companies').innerHTML = companies.map((c) => `<span class="chip" title="${esc(c.aliases.join(', '))}">
    <label class="inline"><input type="checkbox" data-n="${esc(c.name)}" ${selected.has(c.name) ? 'checked' : ''}> ${esc(c.name)}</label>
    <button data-edit="${esc(c.name)}" title="${esc(t('edit'))}">✎</button><button data-del="${esc(c.name)}" title="${esc(t('del'))}">✕</button></span>`).join('');
}

$('companies').addEventListener('click', async (e) => {
  const el = e.target;
  try {
    if (el.dataset.del) {
      if (!confirm(t('confirmDel', { name: el.dataset.del }))) return;
      companies = await api('/api/companies/' + encodeURIComponent(el.dataset.del), { method: 'DELETE' });
      selected.delete(el.dataset.del);
    } else if (el.dataset.edit) {
      const c = companies.find((x) => x.name === el.dataset.edit);
      editing = c.name; $('cName').value = c.name; $('cAliases').value = c.aliases.join(', ');
      $('cSave').textContent = t('edit'); $('cCancel').hidden = false; return;
    } else if (el.dataset.n) {
      el.checked ? selected.add(el.dataset.n) : selected.delete(el.dataset.n);
    }
    renderCompanies();
  } catch (err) { alert(errText(err)); }
});
const resetForm = () => { editing = null; $('compForm').reset(); $('cSave').textContent = t('add'); $('cCancel').hidden = true; };
$('cCancel').onclick = resetForm;
$('compForm').onsubmit = async (e) => {
  e.preventDefault();
  const body = { name: $('cName').value.trim(), aliases: $('cAliases').value.split(',').map((s) => s.trim()).filter(Boolean) };
  try {
    if (editing) {
      companies = await api('/api/companies/' + encodeURIComponent(editing), { method: 'PUT', body });
      if (selected.delete(editing)) selected.add(body.name);
    } else {
      companies = await api('/api/companies', { method: 'POST', body });
      selected.add(body.name);
    }
    resetForm(); renderCompanies();
  } catch (err) { alert(errText(err)); }
};
$('selAll').onclick = () => { selected = new Set(companies.map((c) => c.name)); renderCompanies(); };
$('selNone').onclick = () => { selected.clear(); renderCompanies(); };

$('go').onclick = async () => {
  const missing = ['fromYear', 'dsName', 'dsUrl'].find((id) => !$(id).value.trim());
  if (missing) { $(missing).focus(); setStatus(() => t('needRequired')); return; }
  $('go').disabled = true; $('resultCard').hidden = true;
  $('bar').hidden = false; $('log').hidden = false; lastLogs = []; renderLog(); setStatus(() => t('running'));
  try {
    const { jobId } = await api('/api/search', { method: 'POST', body: {
      fromYear: Number($('fromYear').value), companies: [...selected],
      dataset: { name: $('dsName').value.trim(), url: $('dsUrl').value.trim(), refArxiv: $('dsRef').value.trim(), keywords: $('dsKeywords').value.trim() },
    } });
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200));
      const j = await api('/api/jobs/' + jobId);
      lastLogs = j.logs; renderLog();
      $('bar').firstElementChild.style.width = `${Math.round(j.percent * 100)}%`;
      if (j.status === 'error') throw apiError(j.error, 'error');
      if (j.status === 'done') { showResults(j.result); break; }
    }
    setStatus(() => t('done'));
  } catch (err) { setStatus(() => t('errorPrefix', { msg: errText(err) })); }
  $('go').disabled = false;
};

function renderLog() { $('log').textContent = lastLogs.map(pick).join('\n'); $('log').scrollTop = 1e9; }
const claimText = (r) => {
  const co = r.companies.join(', ');
  const q = r.evidence?.snippets?.[0];
  return `* ${t('claimVenue')}: ${venueLabel(r)}
   * ${t('claimNote')}
* ${t('claimTitle')}: ${r.title} (${r.year})
* ${t('claimCompany')}: ${co}
* ${t('claimLink')}: ${r.url}
* ${t('claimDataset')}: ${r.dataset}
* ${t('claimUsage')}: ${t('claimUsageText', { co, ds: r.dataset })}${q ? `\n    ${t('claimQuote', { q })}` : ''}`;
};
const venueLabel = (r) => `${r.venueInfo.abbr} (${r.year})`;

function renderMeta() {
  const res = lastRes; if (!res) return;
  const parts = [t('metaSource', { src: pick(res.source) }), t('metaScanned', { n: res.scanned }) + (res.skipped ? ' ' + t('metaSkipped', { n: res.skipped }) : ''), t('metaSince', { y: res.fromYear }), t('metaNewest')];
  if (res.reference) parts.push(t('metaRef', { title: res.reference.title + (res.reference.arxiv ? ` (arXiv:${res.reference.arxiv})` : '') }), t('metaKw', { kw: res.keywords.join(', ') }));
  $('meta').textContent = parts.join(' · ');
}
function showResults(res) {
  results = res.results; page = 1; lastRes = res;
  renderMeta(); renderRows(); $('resultCard').hidden = false;
}
function renderRows() {
  const all = filtered(), size = Number($('pageSize').value) || 20;
  const pages = Math.max(1, Math.ceil(all.length / size)); page = Math.min(page, pages);
  const start = (page - 1) * size, list = all.slice(start, start + size);
  $('resCount').textContent = query || $('onlyOfficial').checked ? t('countFiltered', { n: all.length, total: results.length }) : t('countAll', { n: all.length });
  renderPager(pages);
  $('rows').innerHTML = list.map((r, i) => {
    const ev = r.evidence;
    const use = ev?.snippets?.length
      ? `${esc(t('usageFound', { co: r.companies.join(', '), n: ev.mentions }))}<blockquote>“${esc(ev.snippets.join(' … '))}”</blockquote>`
      : `<span class="badge">${esc(t('usageUnknown'))}</span>`;
    return `<tr><td class="no">${all.length - start - i}</td><td>${esc(venueLabel(r))}${r.venueInfo.official ? '' : `<br><span class="badge">${esc(t('notOfficial'))}</span>`}
      ${r.venueInfo.official && r.venueInfo.abbr !== r.venueInfo.name ? `<br><small>${esc(r.venueInfo.name)}</small>` : ''}</td>
      <td>${esc(r.title)} (${esc(r.year)})</td><td>${esc(r.companies.join(', '))}</td>
      <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>${r.publishedUrl && r.publishedUrl !== r.url ? `<br><a href="${esc(r.publishedUrl)}" target="_blank" rel="noopener">${esc(t('publishedLink'))}</a>` : ''}</td>
      <td>${esc(r.dataset)}</td><td>${use}</td><td><button data-copy="${results.indexOf(r)}">${esc(t('copy'))}</button></td></tr>`;
  }).join('') || `<tr><td colspan="8">${esc(t('none'))}</td></tr>`;
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
$('pager').addEventListener('click', (e) => { const p = Number(e.target.dataset.page); if (p) { page = p; renderRows(); $('rows').closest('.scroll').scrollIntoView({ block: 'start' }); } });
$('pageSize').onchange = () => { page = 1; renderRows(); };
let qTimer; $('q').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { query = e.target.value.trim(); page = 1; renderRows(); }, 200); };
$('qClear').onclick = () => { $('q').value = ''; query = ''; page = 1; renderRows(); };
$('onlyOfficial').onchange = renderRows;
$('rows').addEventListener('click', async (e) => {
  const i = e.target.dataset.copy; if (i == null) return;
  await navigator.clipboard.writeText(claimText(results[i])); e.target.textContent = t('copied');
  setTimeout(() => (e.target.textContent = t('copy')), 1500);
});
$('csv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['venue', 'year', 'title', 'companies', 'url', 'dataset', 'evidence'], ...results.map((r) => [venueLabel(r), r.year, r.title, r.companies.join('; '), r.url, r.dataset, r.evidence?.snippets?.[0] || ''])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = 'papers.csv'; a.click();
};
I18N.onChange(() => {
  renderCompanies(); $('cSave').textContent = editing ? t('edit') : t('add');
  $('status').textContent = statusFn(); renderLog(); renderMeta();
  if (results.length || !$('resultCard').hidden) renderRows();
});
init().catch((e) => setStatus(() => t('initError', { msg: errText(e) })));
