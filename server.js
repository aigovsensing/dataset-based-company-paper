import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadCompanies, saveCompanies } from './lib/companies.js';
import { runSearch, DEFAULT_DATASET } from './lib/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const jobs = new Map();

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) reject(new Error('too large')); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
});

async function api(req, res, url) {
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/config') {
    const year = new Date().getFullYear();
    return send(res, 200, { currentYear: year, defaultFromYear: year - 3, dataset: DEFAULT_DATASET });
  }
  if (p === '/api/companies') {
    if (req.method === 'GET') return send(res, 200, await loadCompanies());
    if (req.method === 'PUT') return send(res, 200, await saveCompanies((await readBody(req)).companies)); // 전체 교체
    if (req.method === 'POST') { // 추가
      const c = await readBody(req);
      return send(res, 200, await saveCompanies([...(await loadCompanies()), c]));
    }
  }
  const m = p.match(/^\/api\/companies\/(.+)$/);
  if (m) {
    const name = decodeURIComponent(m[1]);
    const list = await loadCompanies();
    if (!list.some((c) => c.name === name)) return send(res, 404, { error: '회사를 찾을 수 없습니다.' });
    if (req.method === 'DELETE') return send(res, 200, await saveCompanies(list.filter((c) => c.name !== name)));
    if (req.method === 'PUT') { // 수정
      const upd = await readBody(req);
      return send(res, 200, await saveCompanies(list.map((c) => (c.name === name ? upd : c))));
    }
  }
  if (req.method === 'POST' && p === '/api/search') {
    const b = await readBody(req);
    const fromYear = Number(b.fromYear);
    if (!Number.isInteger(fromYear) || fromYear < 2000 || fromYear > new Date().getFullYear()) return send(res, 400, { error: '올바른 시작 연도를 입력하세요.' });
    const all = await loadCompanies();
    const selected = Array.isArray(b.companies) ? all.filter((c) => b.companies.includes(c.name)) : all;
    if (!selected.length) return send(res, 400, { error: '검색할 회사를 1개 이상 선택하세요.' });
    const ds = { ...DEFAULT_DATASET, ...(b.dataset || {}) };
    if (b.dataset?.keywords && !Array.isArray(b.dataset.keywords)) ds.keywords = String(b.dataset.keywords).split(',').map((s) => s.trim()).filter(Boolean);
    const id = randomUUID();
    const job = { status: 'running', logs: [], percent: 0, result: null, error: null };
    jobs.set(id, job);
    runSearch({ fromYear, companies: selected, dataset: ds }, (m) => job.logs.push(m), (p) => { job.percent = p; })
      .then((r) => { job.result = r; job.status = 'done'; })
      .catch((e) => { job.error = e.message; job.status = 'error'; });
    return send(res, 202, { jobId: id });
  }
  const j = p.match(/^\/api\/jobs\/([\w-]+)$/);
  if (req.method === 'GET' && j) {
    const job = jobs.get(j[1]);
    return job ? send(res, 200, job) : send(res, 404, { error: 'job not found' });
  }
  send(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') return send(res, 404, { error: 'not found' });
    send(res, 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
