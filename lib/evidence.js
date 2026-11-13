import { fetchText } from './http.js';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&apos;': "'" };

export function htmlToText(html) {
  return html
    .replace(/<(script|style|svg|math)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h\d|li|tr|section|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function keywordRegex(keywords) {
  const esc = keywords.filter(Boolean).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(esc.join('|'), 'i');
}

const USE_HINT = /evaluat|benchmark|tasks?\b|datasets?|train|test|results?|experiment|fine-?tun/i;

/** 본문 텍스트에서 데이터셋 키워드가 언급된 문장과, 참고문헌 이전 언급 횟수를 추출 */
export function extractEvidence(text, keywords, maxSnippets = 2) {
  const re = keywordRegex(keywords);
  const refIdx = text.lastIndexOf('\nReferences');
  const body = refIdx > text.length * 0.3 ? text.slice(0, refIdx) : text;
  const sentences = body.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z“"(])/);
  const hits = sentences.filter((s) => re.test(s) && s.length > 25 && s.length < 600);
  const globalRe = new RegExp(re.source, 'gi');
  const mentions = (body.match(globalRe) || []).length;
  const scored = hits
    .map((s) => ({ s: s.trim(), score: (USE_HINT.test(s) ? 2 : 0) + (/we (evaluate|use|train|test|report|conduct)/i.test(s) ? 2 : 0) + (/\d+\s+(tasks|datasets)/i.test(s) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  return { mentions, snippets: scored.slice(0, maxSnippets).map((x) => x.s) };
}

/** 제목~저자·소속 블록만 사용 (초록의 'OpenAI embeddings' 같은 단순 언급으로 인한 오탐 방지) */
export function authorBlock(text) {
  // arXiv HTML 은 상단에 내비게이션·목차("Abstract" 포함)가 있고, 실제 제목/저자는 'arXiv:ID [분류]' 줄 다음에 온다.
  const mk = /arXiv:\d{4}\.\d{4,5}v?\d* \[/.exec(text.slice(0, 8000));
  const rest = text.slice(mk ? mk.index : 0, (mk ? mk.index : 0) + 6000);
  const m = /\n\s*Abstract[.:]?\s*(\n|$)/i.exec(rest);
  return m && m.index > 0 ? rest.slice(0, m.index) : rest.slice(0, 1800);
}

/** arXiv HTML 본문을 받아 헤더(저자·소속)와 근거 문장을 반환. 실패 시 null */
export async function fetchArxivEvidence(arxivId, keywords) {
  const id = arxivId.replace(/^arxiv:/i, '').replace(/v\d+$/, '');
  try {
    const html = await fetchText(`https://arxiv.org/html/${id}`, { retries: 2, timeoutMs: 45000 });
    const text = htmlToText(html);
    return { header: authorBlock(text), ...extractEvidence(text, keywords) };
  } catch {
    return null;
  }
}

export function arxivIdFrom(s = '') {
  const m = String(s).match(/arxiv(?:\.org\/(?:abs|pdf|html)\/|[:.]\s*)?(\d{4}\.\d{4,5})/i);
  return m ? m[1] : null;
}
