import { buildMatchers, matchCompanies } from './companies.js';
import { classifyVenue } from './venue.js';
import { fetchArxivEvidence } from './evidence.js';
import { openAlexCandidates, semanticScholarCandidates } from './sources.js';
import { mapPool } from './http.js';
import { resolveReference } from './reference.js';

// 화면의 입력 예시(기본값)일 뿐, 기준 논문/키워드는 입력 내용으로부터 자동 결정된다.
export const DEFAULT_DATASET = {
  name: 'MTEB (Massive Text Embedding Benchmark)',
  url: 'https://github.com/embeddings-benchmark/mteb',
};

const normTitle = (t = '') => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function dedupe(items) {
  const map = new Map();
  for (const it of items) {
    const key = normTitle(it.title);
    const prev = map.get(key);
    // 정식 출판본(학회/저널)을 preprint 보다 우선
    if (!prev || (prev.venueInfo.official === false && it.venueInfo.official)) map.set(key, it);
  }
  return [...map.values()];
}

export async function runSearch({ fromYear, companies, dataset = DEFAULT_DATASET }, log = () => {}, progress = () => {}) {
  const ds = await resolveReference(dataset, log);
  const matchers = buildMatchers(companies);
  const keywords = ds.keywords;

  let cands, source;
  try {
    log('OpenAlex 에서 인용 논문 조회 중…');
    cands = await openAlexCandidates({ refDoi: ds.refDoi, refOaId: ds.refOaId, refTitle: ds.refTitle, fromYear, log });
    source = 'OpenAlex';
  } catch (e) {
    log(`OpenAlex 사용 불가 (${e.message === 'rate-limit-budget' ? '무료 한도 소진 — OPENALEX_API_KEY 설정 권장' : e.message}). Semantic Scholar 로 전환합니다.`);
    cands = await semanticScholarCandidates({ refArxiv: ds.refArxiv, fromYear, log });
    source = 'Semantic Scholar + arXiv 본문 헤더';
  }
  progress(0.3);

  // 1) 소속 정보가 있으면 즉시 회사 판별
  for (const c of cands) c.companies = matchCompanies(c.affiliationText, matchers);

  // 2) 소속 정보가 없는 후보(폴백) 는 arXiv 본문 헤더에서 판별, 매칭 후보는 근거 문장도 추출
  const needHeader = cands.filter((c) => c.source !== 'openalex' && c.arxivId);
  const noArxiv = cands.filter((c) => c.source !== 'openalex' && !c.arxivId).length;
  if (needHeader.length) log(`arXiv 본문에서 소속 확인 중: ${needHeader.length}건${noArxiv ? ` (arXiv ID 없는 ${noArxiv}건은 소속 확인 불가로 제외)` : ''}`);
  let done = 0;
  await mapPool(needHeader, 8, async (c) => {
    const ev = await fetchArxivEvidence(c.arxivId, keywords);
    if (ev) { c.companies = matchCompanies(ev.header, matchers); c.evidence = ev; }
    progress(0.3 + 0.4 * (++done / needHeader.length));
  });

  let matched = cands.filter((c) => c.companies.length);
  log(`Major Company 소속 논문 ${matched.length}건 발견. 원문에서 데이터셋 활용 문구 확인 중…`);
  await mapPool(matched.filter((c) => !c.evidence && c.arxivId), 6, async (c) => {
    c.evidence = await fetchArxivEvidence(c.arxivId, keywords);
  });
  progress(0.95);

  const items = matched.map((c) => ({
    title: c.title, year: c.year, date: c.date, companies: c.companies,
    url: c.arxivId ? `https://arxiv.org/abs/${c.arxivId}` : c.landing,
    publishedUrl: c.landing, doi: c.doi, arxivId: c.arxivId,
    venueInfo: classifyVenue(c.venue),
    dataset: ds.name,
    evidence: c.evidence ? { mentions: c.evidence.mentions, snippets: c.evidence.snippets } : null,
  }));
  const results = dedupe(items).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  progress(1);
  return { source, fromYear, total: results.length, scanned: cands.length, skipped: noArxiv, reference: { title: ds.refTitle, arxiv: ds.refArxiv }, keywords, results };
}
