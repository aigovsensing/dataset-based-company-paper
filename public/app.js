const $ = (id) => document.getElementById(id);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (url, opt) => {
  const r = await fetch(url, opt && { ...opt, headers: { 'Content-Type': 'application/json' }, body: opt.body && JSON.stringify(opt.body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};

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
    <button data-edit="${esc(c.name)}" title="수정">✎</button><button data-del="${esc(c.name)}" title="삭제">✕</button></span>`).join('');
}

$('companies').addEventListener('click', async (e) => {
  const t = e.target;
  try {
    if (t.dataset.del) {
      if (!confirm(`'${t.dataset.del}' 을(를) 삭제할까요?`)) return;
      companies = await api('/api/companies/' + encodeURIComponent(t.dataset.del), { method: 'DELETE' });
      selected.delete(t.dataset.del);
    } else if (t.dataset.edit) {
      const c = companies.find((x) => x.name === t.dataset.edit);
      editing = c.name; $('cName').value = c.name; $('cAliases').value = c.aliases.join(', ');
      $('cSave').textContent = '수정'; $('cCancel').hidden = false; return;
    } else if (t.dataset.n) {
      t.checked ? selected.add(t.dataset.n) : selected.delete(t.dataset.n);
    }
    renderCompanies();
  } catch (err) { alert(err.message); }
});
const resetForm = () => { editing = null; $('compForm').reset(); $('cSave').textContent = '추가'; $('cCancel').hidden = true; };
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
  } catch (err) { alert(err.message); }
};
$('selAll').onclick = () => { selected = new Set(companies.map((c) => c.name)); renderCompanies(); };
$('selNone').onclick = () => { selected.clear(); renderCompanies(); };

$('go').onclick = async () => {
  const missing = ['fromYear', 'dsName', 'dsUrl'].find((id) => !$(id).value.trim());
  if (missing) { $(missing).focus(); $('status').textContent = '필수 항목(몇 년부터, 데이터셋 명칭, 데이터셋 URL)을 입력하세요.'; return; }
  $('go').disabled = true; $('resultCard').hidden = true;
  $('bar').hidden = false; $('log').hidden = false; $('log').textContent = ''; $('status').textContent = '검색 중…';
  try {
    const { jobId } = await api('/api/search', { method: 'POST', body: {
      fromYear: Number($('fromYear').value), companies: [...selected],
      dataset: { name: $('dsName').value.trim(), url: $('dsUrl').value.trim(), refArxiv: $('dsRef').value.trim(), keywords: $('dsKeywords').value.trim() },
    } });
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200));
      const j = await api('/api/jobs/' + jobId);
      $('log').textContent = j.logs.join('\n'); $('log').scrollTop = 1e9;
      $('bar').firstElementChild.style.width = `${Math.round(j.percent * 100)}%`;
      if (j.status === 'error') throw new Error(j.error);
      if (j.status === 'done') { showResults(j.result); break; }
    }
    $('status').textContent = '완료';
  } catch (err) { $('status').textContent = '오류: ' + err.message; }
  $('go').disabled = false;
};

const claimText = (r) => `* 컨퍼런스/저널 (발표/출판년도): ${venueLabel(r)}
   * 참고: arXiv는 공식적인 학술대회가 아닙니다. 학술대회 또는 저널의 논문을 제출해 주십시오.
* 논문명: ${r.title} (${r.year})
* 출판기업: ${r.companies.join(', ')}
* 다운로드 링크: ${r.url}
* 데이터셋: ${r.dataset}
* 활용 명시: ${r.companies.join(', ')} 논문에서 ${r.dataset} 을(를) 활용했음을 명시함.${r.evidence?.snippets?.[0] ? `\n    (논문 내 해당 문구: “${r.evidence.snippets[0]}”)` : ''}`;
const venueLabel = (r) => `${r.venueInfo.abbr} (${r.year})`;

function showResults(res) {
  results = res.results; page = 1;
  $('meta').textContent = `데이터 출처: ${res.source} · 조회 대상 ${res.scanned}건${res.skipped ? ` (소속 확인 불가 ${res.skipped}건 제외)` : ''} · ${res.fromYear}년 이후 · 최신순` + (res.reference ? ` · 기준 논문: ${res.reference.title}${res.reference.arxiv ? ` (arXiv:${res.reference.arxiv})` : ''} · 키워드: ${res.keywords.join(', ')}` : '');
  renderRows(); $('resultCard').hidden = false;
}
function renderRows() {
  const all = filtered(), size = Number($('pageSize').value) || 20;
  const pages = Math.max(1, Math.ceil(all.length / size)); page = Math.min(page, pages);
  const start = (page - 1) * size, list = all.slice(start, start + size);
  $('resCount').textContent = query || $('onlyOfficial').checked ? `(${all.length}건 / 전체 ${results.length}건)` : `(${all.length}건)`;
  renderPager(pages);
  $('rows').innerHTML = list.map((r, i) => {
    const ev = r.evidence;
    const use = ev?.snippets?.length
      ? `${esc(r.companies.join(', '))} 논문 본문에서 데이터셋 언급 ${ev.mentions}회 확인.<blockquote>“${esc(ev.snippets.join(' … '))}”</blockquote>`
      : '<span class="badge">원문 자동 확인 불가 — 논문 본문 직접 확인 필요</span>';
    return `<tr><td class="no">${all.length - start - i}</td><td>${esc(venueLabel(r))}${r.venueInfo.official ? '' : '<br><span class="badge">arXiv: 공식 학술대회 아님</span>'}
      ${r.venueInfo.official && r.venueInfo.abbr !== r.venueInfo.name ? `<br><small>${esc(r.venueInfo.name)}</small>` : ''}</td>
      <td>${esc(r.title)} (${esc(r.year)})</td><td>${esc(r.companies.join(', '))}</td>
      <td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>${r.publishedUrl && r.publishedUrl !== r.url ? `<br><a href="${esc(r.publishedUrl)}" target="_blank" rel="noopener">출판본</a>` : ''}</td>
      <td>${esc(r.dataset)}</td><td>${use}</td><td><button data-copy="${results.indexOf(r)}">소명자료 복사</button></td></tr>`;
  }).join('') || '<tr><td colspan="8">조건에 맞는 논문이 없습니다.</td></tr>';
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
$('pager').addEventListener('click', (e) => { const p = Number(e.target.dataset.page); if (p) { page = p; renderRows(); $('rows').closest('.scroll').scrollIntoView({ block: 'start' }); } });
$('pageSize').onchange = () => { page = 1; renderRows(); };
let qTimer; $('q').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { query = e.target.value.trim(); page = 1; renderRows(); }, 200); };
$('qClear').onclick = () => { $('q').value = ''; query = ''; page = 1; renderRows(); };
$('onlyOfficial').onchange = renderRows;
$('rows').addEventListener('click', async (e) => {
  const i = e.target.dataset.copy; if (i == null) return;
  await navigator.clipboard.writeText(claimText(results[i])); e.target.textContent = '복사됨 ✓';
  setTimeout(() => (e.target.textContent = '소명자료 복사'), 1500);
});
$('csv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['venue', 'year', 'title', 'companies', 'url', 'dataset', 'evidence'], ...results.map((r) => [venueLabel(r), r.year, r.title, r.companies.join('; '), r.url, r.dataset, r.evidence?.snippets?.[0] || ''])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = 'papers.csv'; a.click();
};
init().catch((e) => ($('status').textContent = '초기화 오류: ' + e.message));
