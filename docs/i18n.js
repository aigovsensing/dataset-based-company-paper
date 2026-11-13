// 한국어/영어 UI 사전. data-i18n(텍스트), data-i18n-html(고정 HTML), data-i18n-ph(placeholder), data-i18n-title(title)
(function () {
  const DICT = {
    ko: {
      pageTitle: '데이터셋 기반 Major Company 논문 조회',
      h1: '데이터셋 기반 Major Company 논문 현황',
      subtitle: '입력한 데이터셋을 활용해 학회·저널에 발표된 Major Company 논문을 최신순으로 조회합니다.',
      subtitleDocs: '서버 없이 브라우저에서 OpenAlex 를 직접 조회합니다 (GitHub Pages 용 정적 웹앱).',
      searchCond: '검색 조건', req: '필수',
      fromYear: '몇 년부터', fromYearHint: '기본값: 올해 기준 최근 3년',
      dsName: '데이터셋 명칭', dsUrl: '데이터셋 URL',
      advanced: '고급 옵션 (선택 · 비워두면 자동)',
      keywords: '검색 키워드 (쉼표 구분)', kwPh: '비워두면 데이터셋 명칭에서 자동 생성',
      refId: '기준 논문 arXiv ID', refPh: '비워두면 URL/제목으로 자동 탐색', refHint: '이 논문을 인용한 논문을 후보로 수집',
      apiKey: 'OpenAlex API 키 (선택)', apiKeyHint: '무료 한도 초과 시 입력. 이 브라우저에만 저장됩니다.',
      majorCompany: 'Major Company', selAll: '전체 선택', selNone: '전체 해제',
      exp: 'JSON 내보내기', imp: 'JSON 가져오기', reset: '기본값 복원',
      cNamePh: '회사명', cAliasPh: '별칭(쉼표 구분, 예: Microsoft, Microsoft Research)', cAliasPhShort: '별칭(쉼표 구분)',
      add: '추가', edit: '수정', del: '삭제', cancel: '취소',
      compNote: '회사 목록은 <code>data/major-company-list.json</code> 에 저장됩니다. 칩의 ✎ 수정, ✕ 삭제.',
      compNoteDocs: '회사 목록은 이 브라우저(localStorage)에 저장됩니다. 기본값은 <code>docs/data/major-company-list.json</code> 이며, 내보내기한 JSON 으로 교체할 수 있습니다.',
      go: '검색 실행', running: '검색 중…', done: '완료',
      results: '검색 결과', onlyOfficial: '학회/저널만 (arXiv 제외)', csv: 'CSV 저장',
      searchPh: '검색: 논문명, 기업, 학회/저널, 문구…', clear: '지우기', perPageA: '페이지당', perPageB: '개',
      thNo: 'No.', thVenue: '컨퍼런스/저널 (년도)', thPaper: '논문명 (년도)', thCompany: '출판기업', thLink: '다운로드 링크', thDataset: '데이터셋', thUsage: '활용 명시',
      copy: '관련자료 복사', copied: '복사됨 ✓', publishedLink: '출판본',
      noticeTitle: '예외 활용 조건 안내',
      notice1: '<b>명확한 활용 명시</b>: 논문에 해당 데이터셋이 Train/Test 등으로 활용되었음이 명시되어야 함',
      notice1Docs: '<b>명확한 활용 명시</b>: 논문에 해당 데이터셋이 Train/Test 등으로 활용되었음이 명시되어야 함 — 이 정적 버전은 본문을 자동 추출하지 못하므로(브라우저 CORS 제약) 링크에서 직접 확인하세요. 본문 근거 자동 추출은 <code>npm start</code> 서버 버전에서 지원합니다.',
      notice2: '<b>소명 자료 제출</b>: 논문명·링크를 Request For Exception 에 입력 (각 행의 "관련자료 복사" 사용)',
      notice3: 'arXiv 는 공식 학술대회가 아닙니다. 학술대회 또는 저널에 게재된 논문을 제출하세요.',
      confirmDel: "'{name}' 을(를) 삭제할까요?", importFail: '가져오기 실패: {msg}',
      needRequired: '필수 항목(몇 년부터, 데이터셋 명칭, 데이터셋 URL)을 입력하세요.',
      needCompany: '회사를 1개 이상 선택하세요.',
      errorPrefix: '오류: {msg}', initError: '초기화 오류: {msg}',
      metaSource: '데이터 출처: {src}', metaScanned: '조회 대상 {n}건', metaSkipped: '(소속 확인 불가 {n}건 제외)',
      metaSince: '{y}년 이후', metaNewest: '최신순', metaRef: '기준 논문: {title}', metaKw: '키워드: {kw}',
      countAll: '({n}건)', countFiltered: '({n}건 / 전체 {total}건)',
      usageFound: '{co} 논문 본문에서 데이터셋 언급 {n}회 확인.',
      usageUnknown: '원문 자동 확인 불가 — 논문 본문 직접 확인 필요',
      usageDocs: '본문에서 활용 문구 직접 확인 필요',
      notOfficial: 'arXiv: 공식 학술대회 아님', none: '조건에 맞는 논문이 없습니다.',
      pageOf: '{p} / {n} 페이지',
      claimVenue: '컨퍼런스/저널 (발표/출판년도)', claimNote: '참고: arXiv는 공식적인 학술대회가 아닙니다. 학술대회 또는 저널의 논문을 제출해 주십시오.',
      claimTitle: '논문명', claimCompany: '출판기업', claimLink: '다운로드 링크', claimDataset: '데이터셋', claimUsage: '활용 명시',
      claimUsageText: '{co} 논문에서 {ds} 을(를) 활용했음을 명시함.', claimUsageDocs: '(논문 본문에서 {ds} 활용 문구 확인 후 기재)',
      claimQuote: '(논문 내 해당 문구: “{q}”)',
      // 정적 버전(docs) 전용 메시지
      oaBudget: 'OpenAlex 무료 한도가 소진되었습니다. 무료 API 키를 입력하세요 (https://openalex.org).',
    },
    en: {
      pageTitle: 'Major Company Papers by Dataset',
      h1: 'Major Company Papers Using a Dataset',
      subtitle: 'Find papers published at conferences and journals by major companies that used your dataset, newest first.',
      subtitleDocs: 'Queries OpenAlex directly from your browser, no server needed (static web app for GitHub Pages).',
      searchCond: 'Search criteria', req: 'Required',
      fromYear: 'From year', fromYearHint: 'Default: the last 3 years',
      dsName: 'Dataset name', dsUrl: 'Dataset URL',
      advanced: 'Advanced options (optional · auto if empty)',
      keywords: 'Search keywords (comma separated)', kwPh: 'Auto-generated from the dataset name if empty',
      refId: 'Reference paper arXiv ID', refPh: 'Auto-detected from the URL/title if empty', refHint: 'Papers citing this paper become candidates',
      apiKey: 'OpenAlex API key (optional)', apiKeyHint: 'Enter if the free quota is exhausted. Stored only in this browser.',
      majorCompany: 'Major Companies', selAll: 'Select all', selNone: 'Clear all',
      exp: 'Export JSON', imp: 'Import JSON', reset: 'Restore defaults',
      cNamePh: 'Company name', cAliasPh: 'Aliases (comma separated, e.g. Microsoft, Microsoft Research)', cAliasPhShort: 'Aliases (comma separated)',
      add: 'Add', edit: 'Edit', del: 'Delete', cancel: 'Cancel',
      compNote: 'The company list is saved in <code>data/major-company-list.json</code>. Use ✎ to edit and ✕ to delete a chip.',
      compNoteDocs: 'The company list is saved in this browser (localStorage). Defaults come from <code>docs/data/major-company-list.json</code>; you can replace them with an exported JSON file.',
      go: 'Run search', running: 'Searching…', done: 'Done',
      results: 'Results', onlyOfficial: 'Conferences/journals only (exclude arXiv)', csv: 'Save CSV',
      searchPh: 'Search: title, company, venue, quote…', clear: 'Clear', perPageA: 'Show', perPageB: 'per page',
      thNo: 'No.', thVenue: 'Conference/Journal (Year)', thPaper: 'Paper (Year)', thCompany: 'Company', thLink: 'Download link', thDataset: 'Dataset', thUsage: 'Usage statement',
      copy: 'Copy related materials', copied: 'Copied ✓', publishedLink: 'Published version',
      noticeTitle: 'Exception Use Guidelines',
      notice1: '<b>Explicit usage statement</b>: the paper must state that the dataset was used (e.g. for training or testing).',
      notice1Docs: '<b>Explicit usage statement</b>: the paper must state that the dataset was used (e.g. for training or testing). This static version cannot extract paper text (browser CORS limits), so check the link yourself. Automatic quote extraction is available in the <code>npm start</code> server version.',
      notice2: '<b>Supporting material</b>: enter the paper title and link in Request For Exception (use "Copy related materials" on each row).',
      notice3: 'arXiv is not an official conference. Please submit a paper published at a conference or in a journal.',
      confirmDel: "Delete '{name}'?", importFail: 'Import failed: {msg}',
      needRequired: 'Please fill in the required fields (From year, Dataset name, Dataset URL).',
      needCompany: 'Select at least one company.',
      errorPrefix: 'Error: {msg}', initError: 'Initialization error: {msg}',
      metaSource: 'Source: {src}', metaScanned: '{n} papers scanned', metaSkipped: '({n} excluded: affiliation unavailable)',
      metaSince: 'since {y}', metaNewest: 'newest first', metaRef: 'Reference paper: {title}', metaKw: 'Keywords: {kw}',
      countAll: '({n})', countFiltered: '({n} of {total})',
      usageFound: 'Dataset mentioned {n} times in the paper by {co}.',
      usageUnknown: 'Could not verify automatically — check the paper text',
      usageDocs: 'Check the usage statement in the paper text',
      notOfficial: 'arXiv: not an official venue', none: 'No matching papers.',
      pageOf: 'Page {p} of {n}',
      claimVenue: 'Conference/Journal (Year)', claimNote: 'Note: arXiv is not an official conference. Please submit a paper from a conference or journal.',
      claimTitle: 'Paper title', claimCompany: 'Company', claimLink: 'Download link', claimDataset: 'Dataset', claimUsage: 'Usage statement',
      claimUsageText: 'The paper by {co} states that {ds} was used.', claimUsageDocs: '(fill in after confirming the {ds} usage statement in the paper)',
      claimQuote: '(Quote from the paper: “{q}”)',
      oaBudget: 'The free OpenAlex quota is exhausted. Enter a free API key (https://openalex.org).',
    },
  };

  let lang = 'ko';
  try { lang = localStorage.getItem('lang') || ''; } catch { /* 저장소 사용 불가 */ }
  if (!DICT[lang]) lang = /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
  const listeners = [];

  const fmt = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
  const t = (key, vars) => fmt(DICT[lang][key] ?? DICT.ko[key] ?? key, vars);
  // 서버/라이브러리가 {ko,en} 객체로 보낸 메시지를 현재 언어로 변환
  const pick = (m) => (m && typeof m === 'object' ? m[lang] || m.ko || '' : m ?? '');

  function apply() {
    document.documentElement.lang = lang;
    document.title = t(document.documentElement.dataset.titleKey || 'pageTitle');
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  function setLang(l) {
    if (!DICT[l]) return;
    lang = l;
    try { localStorage.setItem('lang', l); } catch { /* 무시 */ }
    apply();
    listeners.forEach((f) => f(l));
  }
  document.addEventListener('click', (e) => { const l = e.target.closest?.('[data-lang]')?.dataset.lang; if (l) setLang(l); });
  window.I18N = { t, pick, setLang, apply, onChange: (f) => listeners.push(f), get lang() { return lang; } };
  apply();
})();
