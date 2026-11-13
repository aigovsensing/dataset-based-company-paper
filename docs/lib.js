// 브라우저 전용 로직 (서버 없이 OpenAlex 를 직접 호출). GitHub Pages(docs/) 용.
export { classifyVenue } from './venue.js';

// 화면에 보이는 메시지는 {ko, en} 쌍으로 만들어 브라우저가 현재 언어로 고른다.
export const L = (ko, en) => ({ ko, en });
export class I18nError extends Error {
  constructor(ko, en, extra = {}) { super(en ?? ko); this.i18n = { ko, en: en ?? ko }; Object.assign(this, extra); }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalize(list) {
  const seen = new Set();
  return list.map((c) => {
    const name = String(c?.name ?? '').trim();
    if (!name) throw new I18nError('회사 이름이 비어 있습니다.', 'Company name is empty.');
    if (seen.has(name.toLowerCase())) throw new I18nError(`중복된 회사: ${name}`, `Duplicate company: ${name}`);
    seen.add(name.toLowerCase());
    return { name, aliases: [...new Set([name, ...(c.aliases || [])].map((a) => String(a).trim()).filter(Boolean))] };
  });
}
export const buildMatchers = (companies) => companies.map((c) => ({
  name: c.name,
  re: new RegExp(`(^|[^\\p{L}\\p{N}])(${c.aliases.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'iu'),
}));
export const matchCompanies = (text, ms) => (text ? ms.filter((m) => m.re.test(text)).map((m) => m.name) : []);

const arxivIdFrom = (s = '') => (String(s).match(/arxiv(?:\.org\/(?:abs|pdf)\/|[:.]\s*)?(\d{4}\.\d{4,5})/i) || [])[1] || null;
const norm = (t = '') => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    const body = await r.text();
    if (r.status === 429 && /budget/i.test(body)) throw new I18nError('OpenAlex 무료 한도가 소진되었습니다. 무료 API 키를 입력하세요 (https://openalex.org).', 'The free OpenAlex quota is exhausted. Enter a free API key (https://openalex.org).', { budget: true });
    if (r.status < 500 && r.status !== 429) throw new Error(`OpenAlex HTTP ${r.status}`);
    await new Promise((s) => setTimeout(s, 1500 * 2 ** i));
  }
  throw new I18nError('OpenAlex 요청 실패', 'OpenAlex request failed');
}


// ---- 기준 논문 / 키워드 자동 결정 (필수 입력: 데이터셋 명칭, URL 만으로 동작) ----
const KNOWN = [{ match: /embeddings-benchmark\/mteb/i, refArxiv: '2210.07316' }];
export function deriveKeywords(name = '') {
  const parts = name.split(/[()]/).map((x) => x.trim()).filter((x) => x.length >= 3);
  const acr = (name.match(/\b[A-Z][A-Za-z0-9-]*[A-Z0-9][A-Za-z0-9-]*\b/g) || []).filter((w) => w.length >= 3 && /[A-Z].*[A-Z]|\d/.test(w));
  return [...new Set([...parts, ...acr, name.trim()].filter(Boolean))];
}
async function readmeArxiv(url) {
  const m = String(url).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  for (const f of ['README.md', 'readme.md']) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${m[1]}/${m[2].replace(/\.git$/, '')}/HEAD/${f}`);
      if (!r.ok) continue;
      const c = new Map();
      for (const x of (await r.text()).matchAll(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/gi)) c.set(x[1], (c.get(x[1]) || 0) + 1);
      const best = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) return best[0];
    } catch { /* 다음 후보 */ }
  }
  return null;
}
export async function resolveReference(input, q, log) {
  const name = input.name.trim();
  const keywords = deriveKeywords(name);
  let refArxiv = (input.refArxiv || '').trim() || arxivIdFrom(input.url) || KNOWN.find((k) => k.match.test(input.url))?.refArxiv || (await readmeArxiv(input.url));
  if (refArxiv) { log(L(`기준 논문 arXiv:${refArxiv}`, `Reference paper arXiv:${refArxiv}`)); return { name, keywords, refDoi: `10.48550/arXiv.${refArxiv}`, refArxiv, refTitle: name }; }
  for (const query of new Set([name, ...name.split(/[()]/).map((x) => x.trim()).filter((x) => x.length >= 4)])) {
    const r = await getJson(q('/works', { search: query, 'per-page': 5, select: 'id,title,doi,cited_by_count' }));
    const hit = (r.results || []).filter((w) => w.title && keywords.some((k) => w.title.toLowerCase().includes(k.toLowerCase()))).sort((a, b) => b.cited_by_count - a.cited_by_count)[0];
    if (hit) { log(L(`기준 논문 자동 탐색(제목 검색): ${hit.title}`, `Reference paper auto-detected (title search): ${hit.title}`)); return { name, keywords, refOaId: hit.id.split('/').pop(), refTitle: hit.title, refArxiv: arxivIdFrom(hit.doi || '') }; }
  }
  throw new I18nError('기준 논문을 자동으로 찾지 못했습니다. 고급 옵션의 "기준 논문 arXiv ID"를 입력해 주세요.', 'Could not find the reference paper automatically. Please enter the "Reference paper arXiv ID" in Advanced options.');
}

export async function search({ fromYear, companies, dataset, apiKey, log, progress }) {
  const q = (path, p) => {
    const u = new URL('https://api.openalex.org' + path);
    for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
    if (apiKey) u.searchParams.set('api_key', apiKey);
    return u.toString();
  };
  const ds = await resolveReference(dataset, q, log);
  let ref;
  if (ds.refOaId) ref = { id: ds.refOaId, title: ds.refTitle };
  else {
    try { ref = await getJson(q(`/works/doi:${ds.refDoi}`, { select: 'id,title' })); }
    catch (e) { if (e.budget) throw e; ref = (await getJson(q('/works', { search: ds.refTitle, 'per-page': 1, select: 'id,title' }))).results?.[0]; }
  }
  const refId = ref.id.split('/').pop();
  log(L(`기준 논문: ${ref.title}`, `Reference paper: ${ref.title}`));
  dataset = ds;

  const matchers = buildMatchers(companies);
  const found = [];
  let scanned = 0;
  for (let page = 1; page <= 50; page++) {
    const r = await getJson(q('/works', {
      filter: `cites:${refId},from_publication_date:${fromYear}-01-01`, sort: 'publication_date:desc', 'per-page': 200, page,
      select: 'id,doi,title,publication_date,publication_year,primary_location,locations,authorships',
    }));
    const total = r.meta?.count ?? 0;
    for (const w of r.results || []) {
      scanned++;
      const aff = (w.authorships || []).flatMap((a) => [...(a.raw_affiliation_strings || []), ...(a.institutions || []).map((i) => i.display_name)]).join(' ; ');
      const cs = matchCompanies(aff, matchers);
      if (!cs.length) continue;
      const locs = [w.primary_location, ...(w.locations || [])].filter(Boolean);
      const axLoc = locs.find((l) => /arxiv\.org/i.test(l.landing_page_url || ''));
      const pub = locs.find((l) => l.source && l.source.type !== 'repository');
      const doi = (w.doi || '').replace(/^https?:\/\/doi\.org\//, '');
      const arxivId = arxivIdFrom(axLoc?.landing_page_url) || arxivIdFrom(doi);
      const landing = pub?.landing_page_url || axLoc?.landing_page_url || (doi ? `https://doi.org/${doi}` : w.id);
      found.push({
        title: w.title, year: w.publication_year, date: w.publication_date, companies: cs, doi, arxivId,
        url: arxivId ? `https://arxiv.org/abs/${arxivId}` : landing, publishedUrl: landing,
        venue: pub ? { name: pub.source.display_name, type: pub.source.type } : { name: 'arXiv', type: 'repository' },
        dataset: dataset.name,
      });
    }
    log(L(`인용 논문 ${scanned} / ${total} 확인, Major Company ${found.length}건`, `Checked ${scanned} / ${total} citing papers, ${found.length} from Major Companies`));
    progress(total ? scanned / total : 1);
    if (!r.results?.length || scanned >= total) break;
  }
  return { scanned, results: found, reference: { title: ref.title, arxiv: ds.refArxiv }, keywords: ds.keywords };
}

export function dedupe(items) {
  const m = new Map();
  for (const it of items) {
    const k = norm(it.title), p = m.get(k);
    if (!p || (!p.venueInfo.official && it.venueInfo.official)) m.set(k, it);
  }
  return [...m.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
