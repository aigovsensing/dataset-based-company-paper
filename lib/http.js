// 재시도/백오프가 포함된 JSON·텍스트 fetch 헬퍼
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function fetchWithRetry(url, { headers = {}, retries = 4, timeoutMs = 30000, accept } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'dataset-paper-tracker/1.0', ...(accept ? { Accept: accept } : {}), ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      const body = await res.text().catch(() => '');
      // OpenAlex 일일 예산 소진(429 + retryAfter 매우 큼)은 재시도 무의미
      if (res.status === 429 && /Insufficient budget|daily/i.test(body)) throw new HttpError('rate-limit-budget', 429, body);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(`HTTP ${res.status}`, res.status, body);
        await sleep(Math.min(1500 * 2 ** attempt, 15000));
        continue;
      }
      throw new HttpError(`HTTP ${res.status}`, res.status, body);
    } catch (e) {
      if (e instanceof HttpError && (e.status < 500 && e.status !== 429 || e.message === 'rate-limit-budget')) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(Math.min(1000 * 2 ** attempt, 10000));
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts) {
  return (await fetchWithRetry(url, { ...opts, accept: 'application/json' })).json();
}

export async function fetchText(url, opts) {
  return (await fetchWithRetry(url, opts)).text();
}

// 단순 동시성 제한 map
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
