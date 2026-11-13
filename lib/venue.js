// 학회/저널 분류. arXiv 등 preprint 서버는 공식 학술대회가 아니므로 별도 표시한다.
const KNOWN = [
  [/international conference on learning representations|\biclr\b/i, 'ICLR'],
  [/neural information processing systems|\bneurips\b|\bnips\b/i, 'NeurIPS'],
  [/international conference on machine learning|\bicml\b/i, 'ICML'],
  [/empirical methods in natural language processing|\bemnlp\b/i, 'EMNLP'],
  [/north american chapter|\bnaacl\b/i, 'NAACL'],
  [/european chapter of the association for computational linguistics|\beacl\b/i, 'EACL'],
  [/annual meeting of the association for computational linguistics|\bacl\b/i, 'ACL'],
  [/findings of the association/i, 'Findings of ACL'],
  [/transactions of the association for computational linguistics|\btacl\b/i, 'TACL'],
  [/\bcoling\b|international conference on computational linguistics/i, 'COLING'],
  [/\bsigir\b/i, 'SIGIR'],
  [/\bcikm\b|information and knowledge management/i, 'CIKM'],
  [/\bkdd\b|knowledge discovery and data mining/i, 'KDD'],
  [/\bthe web conference\b|world wide web|\bwww\b/i, 'WWW'],
  [/\baaai\b/i, 'AAAI'],
  [/\bijcai\b/i, 'IJCAI'],
  [/\bcvpr\b/i, 'CVPR'],
  [/\biccv\b/i, 'ICCV'],
  [/\bsigmod\b/i, 'SIGMOD'],
  [/\bvldb\b/i, 'VLDB'],
  [/\becir\b/i, 'ECIR'],
  [/\brecsys\b/i, 'RecSys'],
  [/\bwsdm\b/i, 'WSDM'],
  [/\binterspeech\b/i, 'Interspeech'],
  [/\bicassp\b/i, 'ICASSP'],
];

const PREPRINT = /\barxiv\b|corr\b|preprint|openreview preprint|ssrn|researchsquare|biorxiv|medrxiv|hal\b.*archive|zenodo/i;

export function isPreprintName(name = '') {
  return PREPRINT.test(name);
}

/**
 * @param {{name?:string, type?:string}} v  type: conference | journal | repository | ...
 */
export function classifyVenue(v = {}) {
  const name = (v.name || '').trim();
  if (!name || isPreprintName(name) || v.type === 'repository') {
    return { kind: 'preprint', name: name || 'arXiv', abbr: 'arXiv', official: false };
  }
  let abbr = '';
  for (const [re, a] of KNOWN) if (re.test(name)) { abbr = a; break; }
  const kind = v.type === 'journal' ? 'journal' : v.type === 'conference' ? 'conference' : abbr ? 'conference' : 'unknown';
  return { kind, name, abbr: abbr || name, official: true };
}
