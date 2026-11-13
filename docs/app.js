import { normalize, search, dedupe, classifyVenue } from './lib.js';
const $ = (id) => document.getElementById(id);
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
  $('companies').innerHTML = companies.map((c) => `<span class="chip" title="${esc(c.aliases.join(', '))}"><label class="inline"><input type="checkbox" data-n="${esc(c.name)}" ${selected.has(c.name) ? 'checked' : ''}> ${esc(c.name)}</label><button data-edit="${esc(c.name)}">✎</button><button data-del="${esc(c.name)}">✕</button></span>`).join('');
}
$('companies').addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.del) { if (!confirm(`'${t.dataset.del}' 을(를) 삭제할까요?`)) return; companies = companies.filter((c) => c.name !== t.dataset.del); selected.delete(t.dataset.del); persist(); }
  else if (t.dataset.edit) { const c = companies.find((x) => x.name === t.dataset.edit); editing = c.name; $('cName').value = c.name; $('cAliases').value = c.aliases.join(', '); $('cSave').textContent = '수정'; $('cCancel').hidden = false; return; }
  else if (t.dataset.n) t.checked ? selected.add(t.dataset.n) : selected.delete(t.dataset.n);
  render();
});
const resetForm = () => { editing = null; $('compForm').reset(); $('cSave').textContent = '추가'; $('cCancel').hidden = true; };
$('cCancel').onclick = resetForm;
$('compForm').onsubmit = (e) => {
  e.preventDefault();
  const c = { name: $('cName').value.trim(), aliases: $('cAliases').value.split(',').map((s) => s.trim()).filter(Boolean) };
  try {
    companies = normalize(editing ? companies.map((x) => (x.name === editing ? c : x)) : [...companies, c]);
    if (editing && selected.delete(editing)) selected.add(c.name); else if (!editing) selected.add(c.name);
    persist(); resetForm(); render();
  } catch (err) { alert(err.message); }
};
$('selAll').onclick = () => { selected = new Set(companies.map((c) => c.name)); render(); };
$('selNone').onclick = () => { selected.clear(); render(); };
$('reset').onclick = async () => { companies = await defaults(); selected = new Set(companies.map((c) => c.name)); persist(); render(); };
$('exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(companies, null, 2) + '\n'], { type: 'application/json' })); a.download = 'major-company-list.json'; a.click(); };
$('imp').onclick = () => $('impFile').click();
$('impFile').onchange = async (e) => { try { companies = normalize(JSON.parse(await e.target.files[0].text())); selected = new Set(companies.map((c) => c.name)); persist(); render(); } catch (err) { alert('가져오기 실패: ' + err.message); } };

const venueLabel = (r) => `${r.venueInfo.abbr} (${r.year})`;
const claim = (r) => `* 컨퍼런스/저널 (발표/출판년도): ${venueLabel(r)}\n   * 참고: arXiv는 공식적인 학술대회가 아닙니다. 학술대회 또는 저널의 논문을 제출해 주십시오.\n* 논문명: ${r.title} (${r.year})\n* 출판기업: ${r.companies.join(', ')}\n* 다운로드 링크: ${r.url}\n* 데이터셋: ${r.dataset}\n* 활용 명시: (논문 본문에서 ${r.dataset} 활용 문구 확인 후 기재)`;

$('go').onclick = async () => {
  const missing = ['fromYear', 'dsName', 'dsUrl'].find((id) => !$(id).value.trim());
  if (missing) { $(missing).focus(); $('status').textContent = '필수 항목(몇 년부터, 데이터셋 명칭, 데이터셋 URL)을 입력하세요.'; return; }
  const ref = $('dsRef').value.trim(); const key = $('apiKey').value.trim(); store.set('apiKey', key);
  $('go').disabled = true; $('resultCard').hidden = true; $('bar').hidden = false; $('log').hidden = false; $('log').textContent = ''; $('status').textContent = '검색 중…';
  const log = (m) => { $('log').textContent += m + '\n'; $('log').scrollTop = 1e9; };
  try {
    if (!selected.size) throw new Error('회사를 1개 이상 선택하세요.');
    const dataset = { name: $('dsName').value.trim(), url: $('dsUrl').value.trim(), refArxiv: ref };
    const r = await search({ fromYear: Number($('fromYear').value), companies: companies.filter((c) => selected.has(c.name)), dataset, apiKey: key, log, progress: (p) => ($('bar').firstElementChild.style.width = `${Math.round(p * 100)}%`) });
    page = 1;
    results = dedupe(r.results.map((x) => ({ ...x, venueInfo: classifyVenue(x.venue) })));
    $('meta').textContent = `데이터 출처: OpenAlex · 조회 대상 ${r.scanned}건 · ${$('fromYear').value}년 이후 · 최신순 · 기준 논문: ${r.reference.title}${r.reference.arxiv ? ` (arXiv:${r.reference.arxiv})` : ''} · 키워드: ${r.keywords.join(', ')}`;
    rows(); $('resultCard').hidden = false; $('status').textContent = '완료';
  } catch (err) { $('status').textContent = '오류: ' + err.message; }
  $('go').disabled = false;
};
function rows() {
  const all = filtered(), size = Number($('pageSize').value) || 20;
  const pages = Math.max(1, Math.ceil(all.length / size)); page = Math.min(page, pages);
  const start = (page - 1) * size, list = all.slice(start, start + size);
  $('resCount').textContent = query || $('onlyOfficial').checked ? `(${all.length}건 / 전체 ${results.length}건)` : `(${all.length}건)`;
  renderPager(pages);
  $('rows').innerHTML = list.map((r, i) => `<tr><td class="no">${all.length - start - i}</td><td>${esc(venueLabel(r))}${r.venueInfo.official ? (r.venueInfo.abbr !== r.venueInfo.name ? `<br><small>${esc(r.venueInfo.name)}</small>` : '') : '<br><span class="badge">arXiv: 공식 학술대회 아님</span>'}</td>
  <td>${esc(r.title)} (${esc(r.year)})</td><td>${esc(r.companies.join(', '))}</td>
  <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>${r.publishedUrl !== r.url ? `<br><a href="${esc(r.publishedUrl)}" target="_blank" rel="noopener">출판본</a>` : ''}</td>
  <td>${esc(r.dataset)}</td><td><span class="badge">본문에서 활용 문구 직접 확인 필요</span></td><td><button data-copy="${results.indexOf(r)}">소명자료 복사</button></td></tr>`).join('') || '<tr><td colspan="8">조건에 맞는 논문이 없습니다.</td></tr>';
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
  $('pager').innerHTML = pages > 1 ? h + `<span class="sub">&nbsp;${page} / ${pages} 페이지</span>` : '';
}
$('pager').addEventListener('click', (e) => { const p = Number(e.target.dataset.page); if (p) { page = p; rows(); $('rows').closest('.scroll').scrollIntoView({ block: 'start' }); } });
$('pageSize').onchange = () => { page = 1; rows(); };
let qTimer; $('q').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { query = e.target.value.trim(); page = 1; rows(); }, 200); };
$('qClear').onclick = () => { $('q').value = ''; query = ''; page = 1; rows(); };
$('onlyOfficial').onchange = rows;
$('rows').addEventListener('click', async (e) => { const i = e.target.dataset.copy; if (i == null) return; await navigator.clipboard.writeText(claim(results[i])); e.target.textContent = '복사됨 ✓'; setTimeout(() => (e.target.textContent = '소명자료 복사'), 1500); });
$('csv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rs = [['venue', 'year', 'title', 'companies', 'url', 'dataset'], ...results.map((r) => [venueLabel(r), r.year, r.title, r.companies.join('; '), r.url, r.dataset])];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rs.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'papers.csv'; a.click();
};
init();
