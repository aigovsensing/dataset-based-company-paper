import { fetchJson, mapPool } from './http.js';
import { arxivIdFrom } from './evidence.js';

const OA = 'https://api.openalex.org';
const S2 = 'https://api.semanticscholar.org/graph/v1';

function oaUrl(path, params) {
  const u = new URL(OA + path);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  if (process.env.OPENALEX_API_KEY) u.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
  else if (process.env.OPENALEX_MAILTO) u.searchParams.set('mailto', process.env.OPENALEX_MAILTO);
  return u.toString();
}

/**
 * OpenAlex: 기준 논문을 인용하는 모든 논문(fromYear 이후)을 가져온다.
 * 소속은 raw_affiliation_strings 를 그대로 반환 → 호출측에서 회사 매칭.
 */
export async function openAlexCandidates({ refDoi, refOaId, refTitle, fromYear, maxPages = 30, log }) {
  let ref;
  if (refOaId) ref = { id: refOaId, title: refTitle };
  else try {
    ref = await fetchJson(oaUrl(`/works/doi:${encodeURIComponent(refDoi)}`, { select: 'id,title' }));
  } catch (e) {
    if (e.message === 'rate-limit-budget') throw e;
    const r = await fetchJson(oaUrl('/works', { search: refTitle, 'per-page': 1, select: 'id,title' }));
    ref = r.results?.[0];
  }
  if (!ref?.id) throw new Error('OpenAlex 에서 기준 논문을 찾지 못했습니다.');
  const refId = ref.id.split('/').pop();
  log?.(`OpenAlex 기준 논문: ${ref.title} (${refId})`);

  const out = [];
  let cursor = '*';
  for (let page = 1; page <= maxPages && cursor; page++) {
    const r = await fetchJson(oaUrl('/works', {
      filter: `cites:${refId},from_publication_date:${fromYear}-01-01`,
      sort: 'publication_date:desc',
      'per-page': 200,
      cursor,
      select: 'id,doi,title,publication_date,publication_year,type,primary_location,locations,authorships',
    }));
    for (const w of r.results || []) out.push(fromOpenAlex(w));
    cursor = r.meta?.next_cursor;
    log?.(`OpenAlex 인용 논문 수집: ${out.length} / ${r.meta?.count ?? '?'}`);
    if (!r.results?.length) break;
  }
  return out;
}

function fromOpenAlex(w) {
  const locs = [w.primary_location, ...(w.locations || [])].filter(Boolean);
  const arxivLoc = locs.find((l) => /arxiv\.org/i.test(l.landing_page_url || ''));
  const published = locs.find((l) => l.source && l.source.type !== 'repository');
  const doi = (w.doi || '').replace(/^https?:\/\/doi\.org\//, '');
  return {
    id: w.id,
    title: w.title,
    date: w.publication_date,
    year: w.publication_year,
    doi,
    arxivId: arxivIdFrom(arxivLoc?.landing_page_url) || arxivIdFrom(doi),
    landing: published?.landing_page_url || arxivLoc?.landing_page_url || w.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : ''),
    venue: published ? { name: published.source.display_name, type: published.source.type } : { name: 'arXiv', type: 'repository' },
    affiliationText: (w.authorships || []).flatMap((a) => [...(a.raw_affiliation_strings || []), ...(a.institutions || []).map((i) => i.display_name)]).join(' ; '),
    source: 'openalex',
  };
}

/** Semantic Scholar 폴백: 인용 논문 목록 (소속 정보 없음 → arXiv 본문 헤더로 판별) */
export async function semanticScholarCandidates({ refArxiv, fromYear, maxItems = 5000, log }) {
  if (!refArxiv) throw new Error('기준 논문의 arXiv ID 를 알 수 없어 Semantic Scholar 폴백을 쓸 수 없습니다. "기준 논문 arXiv ID"를 입력해 주세요.');
  const headers = process.env.S2_API_KEY ? { 'x-api-key': process.env.S2_API_KEY } : {};
  const fields = 'title,year,venue,publicationVenue,publicationDate,externalIds,journal';
  const out = [];
  for (let offset = 0; offset < maxItems; offset += 500) {
    const r = await fetchJson(`${S2}/paper/arXiv:${refArxiv}/citations?fields=${fields}&limit=500&offset=${offset}`, { headers, retries: 6 });
    for (const { citingPaper: p } of r.data || []) {
      if (!p?.title || (p.year && p.year < fromYear)) continue;
      const ax = p.externalIds?.ArXiv || null;
      const doi = p.externalIds?.DOI || '';
      const pv = p.publicationVenue;
      out.push({
        id: p.paperId, title: p.title, date: p.publicationDate || (p.year ? `${p.year}-01-01` : ''), year: p.year, doi,
        arxivId: ax || arxivIdFrom(doi),
        landing: ax ? `https://arxiv.org/abs/${ax}` : doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${p.paperId}`,
        venue: { name: pv?.name || p.venue || p.journal?.name || '', type: pv?.type || '' },
        affiliationText: '', source: 'semanticscholar',
      });
    }
    log?.(`Semantic Scholar 인용 논문 수집: ${out.length}건 (offset ${offset})`);
    if (!r.next) break;
  }
  return out;
}

export { mapPool };
