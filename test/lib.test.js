import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, buildMatchers, matchCompanies } from '../lib/companies.js';
import { classifyVenue } from '../lib/venue.js';
import { extractEvidence, arxivIdFrom } from '../lib/evidence.js';
import { dedupe } from '../lib/search.js';

test('회사 매칭은 단어 경계를 지킨다', () => {
  const m = buildMatchers(normalize([{ name: 'Intel' }, { name: 'MS', aliases: ['Microsoft'] }, { name: 'NVIDIA' }]));
  assert.deepEqual(matchCompanies('Artificial Intelligence Lab, Seoul', m), []);
  assert.deepEqual(matchCompanies('Intel Labs; Microsoft Research; nvidia', m), ['Intel', 'MS', 'NVIDIA']);
});
test('회사 중복 이름 거부', () => assert.throws(() => normalize([{ name: 'A' }, { name: 'a' }])));
test('venue 분류', () => {
  assert.equal(classifyVenue({ name: 'arXiv.org' }).official, false);
  assert.equal(classifyVenue({ name: 'International Conference on Learning Representations', type: 'conference' }).abbr, 'ICLR');
  assert.equal(classifyVenue({ name: 'Nature', type: 'journal' }).kind, 'journal');
});
test('근거 문장 추출', () => {
  const t = 'Intro text here.\n5.1 MTEB Results\nWe evaluate the proposed NV-Embed model on the full MTEB benchmark across 56 tasks. Other sentence.\nReferences\nMuennighoff. MTEB: Massive Text Embedding Benchmark. 2022.'.padEnd(10, ' ');
  const e = extractEvidence(t, ['MTEB']);
  assert.match(e.snippets[0], /56 tasks/);
});
test('arXiv ID 파싱', () => {
  assert.equal(arxivIdFrom('https://arxiv.org/abs/2405.17428v2'), '2405.17428');
  assert.equal(arxivIdFrom('10.48550/arXiv.2405.17428'), '2405.17428');
});
test('dedupe 는 출판본 우선', () => {
  const r = dedupe([{ title: 'A B', venueInfo: { official: false } }, { title: 'a  b', venueInfo: { official: true } }]);
  assert.equal(r.length, 1); assert.equal(r[0].venueInfo.official, true);
});
import { authorBlock } from '../lib/evidence.js';
test('저자 블록은 초록 이전까지만', () => {
  assert.equal(authorBlock('Title\nJane Doe, Google\nAbstract\nWe compare with OpenAI embeddings'), 'Title\nJane Doe, Google\n');
});
