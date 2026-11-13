import { fetchJson, fetchText } from './http.js';
import { arxivIdFrom } from './evidence.js';
import { L, I18nError } from './i18n.js';

// 널리 쓰이는 데이터셋은 자동 탐색 실패에 대비해 기준 논문을 미리 알고 있다.
const KNOWN = [{ match: /embeddings-benchmark\/mteb/i, refArxiv: '2210.07316' }];

/** 데이터셋 명칭에서 본문 검색용 키워드 자동 생성: 전체 이름, 괄호 안/밖 이름, 약어(MTEB 등) */
export function deriveKeywords(name = '') {
  const parts = name.split(/[()]/).map((s) => s.trim()).filter((s) => s.length >= 3);
  const acronyms = (name.match(/\b[A-Z][A-Za-z0-9-]*[A-Z0-9][A-Za-z0-9-]*\b/g) || []).filter((w) => w.length >= 3 && /[A-Z].*[A-Z]|\d/.test(w));
  return [...new Set([...parts, ...acronyms, name.trim()].filter(Boolean))];
}

const oaParams = () => (process.env.OPENALEX_API_KEY ? `&api_key=${process.env.OPENALEX_API_KEY}` : process.env.OPENALEX_MAILTO ? `&mailto=${process.env.OPENALEX_MAILTO}` : '');

async function fromGithubReadme(url) {
  const m = String(url).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/, '');
  for (const file of ['README.md', 'readme.md']) {
    try {
      const txt = await fetchText(`https://raw.githubusercontent.com/${m[1]}/${repo}/HEAD/${file}`, { retries: 1 });
      const counts = new Map();
      for (const x of txt.matchAll(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/gi)) counts.set(x[1], (counts.get(x[1]) || 0) + 1);
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) return best[0];
    } catch { /* 다음 후보 */ }
  }
  return null;
}

async function fromOpenAlexSearch(name, keywords) {
  const queries = [...new Set([name, ...name.split(/[()]/).map((s) => s.trim()).filter((s) => s.length >= 4)])];
  for (const q of queries) {
    try {
      const r = await fetchJson(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=5&select=id,title,doi,cited_by_count${oaParams()}`);
      const hit = (r.results || [])
        .filter((w) => w.title && keywords.some((k) => w.title.toLowerCase().includes(k.toLowerCase())))
        .sort((a, b) => b.cited_by_count - a.cited_by_count)[0];
      if (hit) return { refOaId: hit.id.split('/').pop(), refDoi: (hit.doi || '').replace(/^https?:\/\/doi\.org\//, ''), refTitle: hit.title, refArxiv: arxivIdFrom(hit.doi || '') };
    } catch (e) { if (e.message === 'rate-limit-budget') throw e; }
  }
  return null;
}

/**
 * 필수 입력(name, url)만으로 기준 논문과 키워드를 확정한다.
 * 우선순위: 사용자 입력 ID > URL 의 arXiv ID > 알려진 데이터셋 > GitHub README 의 arXiv 링크 > OpenAlex 제목 검색
 */
export async function resolveReference(input, log = () => {}) {
  const name = (input.name || '').trim();
  const keywords = (Array.isArray(input.keywords) ? input.keywords : String(input.keywords || '').split(',')).map((s) => s.trim()).filter(Boolean);
  const kw = keywords.length ? keywords : deriveKeywords(name);
  let refArxiv = (input.refArxiv || '').trim() || arxivIdFrom(input.url) || KNOWN.find((k) => k.match.test(input.url || ''))?.refArxiv || null;
  let how = input.refArxiv?.trim() ? L('입력값', 'user input') : refArxiv ? L('URL/알려진 데이터셋', 'URL / known dataset') : null;
  if (!refArxiv) { refArxiv = await fromGithubReadme(input.url); how = refArxiv ? L('GitHub README', 'GitHub README') : null; }
  if (refArxiv) {
    log(L(`기준 논문 arXiv:${refArxiv} (${how.ko})`, `Reference paper arXiv:${refArxiv} (${how.en})`));
    return { name, url: input.url, keywords: kw, refArxiv, refDoi: `10.48550/arXiv.${refArxiv}`, refTitle: name };
  }
  const found = await fromOpenAlexSearch(name, kw);
  if (found) {
    log(L(`기준 논문 자동 탐색(OpenAlex 제목 검색): ${found.refTitle}`, `Reference paper auto-detected (OpenAlex title search): ${found.refTitle}`));
    return { name, url: input.url, keywords: kw, ...found };
  }
  throw new I18nError('기준 논문을 자동으로 찾지 못했습니다. 화면의 "기준 논문 arXiv ID"를 입력해 주세요.', 'Could not find the reference paper automatically. Please enter the "Reference paper arXiv ID".');
}
