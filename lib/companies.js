import { promises as fs } from 'node:fs';
import path from 'node:path';
import { I18nError } from './i18n.js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COMPANY_FILE = process.env.COMPANY_FILE || path.join(__dirname, '..', 'data', 'major-company-list.json');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalize(list) {
  if (!Array.isArray(list)) throw new I18nError('회사 목록은 배열이어야 합니다.', 'The company list must be an array.');
  const seen = new Set();
  return list.map((c) => {
    const name = String(typeof c === 'string' ? c : c?.name ?? '').trim();
    if (!name) throw new I18nError('회사 이름이 비어 있습니다.', 'Company name is empty.');
    if (seen.has(name.toLowerCase())) throw new I18nError(`중복된 회사: ${name}`, `Duplicate company: ${name}`);
    seen.add(name.toLowerCase());
    const aliases = [...new Set([name, ...(Array.isArray(c?.aliases) ? c.aliases : [])].map((a) => String(a).trim()).filter(Boolean))];
    return { name, aliases };
  });
}

export async function loadCompanies() {
  return normalize(JSON.parse(await fs.readFile(COMPANY_FILE, 'utf8')));
}

export async function saveCompanies(list) {
  const clean = normalize(list);
  await fs.mkdir(path.dirname(COMPANY_FILE), { recursive: true });
  await fs.writeFile(COMPANY_FILE, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}

// 별칭을 단어 경계 기준(대소문자 무시)으로 매칭 — "Intel" 이 "Intelligence" 에 걸리지 않도록
export function buildMatchers(companies) {
  return companies.map((c) => ({
    name: c.name,
    re: new RegExp(`(^|[^\\p{L}\\p{N}])(${c.aliases.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'iu'),
  }));
}

export function matchCompanies(text, matchers) {
  if (!text) return [];
  return matchers.filter((m) => m.re.test(text)).map((m) => m.name);
}
