// 브라우저 전용 로직 (서버 없이 OpenAlex 를 직접 호출). GitHub Pages(docs/) 용.
export { classifyVenue } from './venue.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalize(list) {
  const seen = new Set();
  return list.map((c) => {
    const name = String(c?.name ?? '').trim();
    if (!name) throw new Error('회사 이름이 비어 있습니다.');
    if (seen.has(name.toLowerCase())) throw new Error(`중복된 회사: ${name}`);
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
    if (r.status === 429 && /budget/i.test(body)) throw new Error('OpenAlex 무료 한도가 소진되었습니다. 무료 API 키를 입력하세요 (https://openalex.org).');
    if (r.status < 500 && r.status !== 429) throw new Error(`OpenAlex HTTP ${r.status}`);
    await new Promise((s) => setTimeout(s, 1500 * 2 ** i));
  }
  throw new Error('OpenAlex 요청 실패');
}

export async function search({ fromYear, companies, dataset, apiKey, log, progress }) {
  const q = (path, p) => {
    const u = new URL('https://api.openalex.org' + path);
    for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
    if (apiKey) u.searchParams.set('api_key', apiKey);
    return u.toString();
  };
  let ref;
  try { ref = await getJson(q(`/works/doi:${dataset.refDoi}`, { select: 'id,title' })); }
  catch (e) { if (/한도/.test(e.message)) throw e; ref = (await getJson(q('/works', { search: dataset.refTitle, 'per-page': 1, select: 'id,title' }))).results?.[0]; }
  if (!ref?.id) throw new Error('기준 논문을 OpenAlex 에서 찾지 못했습니다.');
  const refId = ref.id.split('/').pop();
  log(`기준 논문: ${ref.title}`);

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
    log(`인용 논문 ${scanned} / ${total} 확인, Major Company ${found.length}건`);
    progress(total ? scanned / total : 1);
    if (!r.results?.length || scanned >= total) break;
  }
  return { scanned, results: found };
}

export function dedupe(items) {
  const m = new Map();
  for (const it of items) {
    const k = norm(it.title), p = m.get(k);
    if (!p || (!p.venueInfo.official && it.venueInfo.official)) m.set(k, it);
  }
  return [...m.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
