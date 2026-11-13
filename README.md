# 데이터셋 기반 Major Company 논문 조회 웹앱

입력한 데이터셋(기본: MTEB)을 활용해 Major Company 소속 연구자가 발표한 논문을 최신순 테이블로 보여줍니다.
(컨퍼런스/저널·년도, 논문명, 출판기업, 다운로드 링크, 데이터셋, 활용 명시 + 논문 본문 근거 문장, "소명자료 복사")

## 실행
```bash
npm start          # http://localhost:3000  (PORT 환경변수로 변경)
npm test
```
의존성 없음 (Node.js 20+).

## 동작 방식
1. 기준 논문(MTEB: arXiv 2210.07316)을 **인용**한 논문을 시작 연도 이후로 수집
   - 1순위 **OpenAlex** (소속 문자열 직접 사용). 무료 일일 한도가 소진되면 `OPENALEX_API_KEY`(무료 발급) 설정 권장
   - 실패 시 **Semantic Scholar** 로 자동 폴백 → arXiv HTML 본문의 저자·소속 블록으로 회사 판별 (arXiv ID 없는 논문은 제외)
2. `data/major-company-list.json` 의 회사명/별칭과 단어 경계 매칭
3. arXiv 본문에서 데이터셋 키워드(MTEB 등) 언급 문장을 추출해 "활용 명시" 근거로 표시
4. arXiv 만 있는 논문은 "공식 학술대회 아님" 배지 표시, "학회/저널만" 체크로 제외 가능

## 설정
- 시작 연도 기본값: 올해 − 3년 (사용자 수정 가능)
- 회사 목록: 화면에서 추가/수정/삭제 → `data/major-company-list.json` 에 저장 (`COMPANY_FILE` 로 경로 변경 가능)
- 환경변수: `OPENALEX_API_KEY`, `OPENALEX_MAILTO`, `S2_API_KEY`(선택)

> 자동 판별은 보조 수단입니다. 소명자료 제출 전 논문 원문에서 소속·데이터셋 활용 문구를 직접 확인하세요.
