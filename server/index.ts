import { config as loadEnv } from 'dotenv';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
loadEnv({ path: resolve(root, '.env') });
loadEnv({ path: resolve(root, '.env.local'), override: true });

type Provider = 'openai' | 'claude' | 'gemini' | 'custom';
type ProviderSettings = { provider: Provider; apiKey: string; apiUrl: string; model: string };
const providers: Provider[] = ['openai', 'claude', 'gemini', 'custom'];
const defaults: Record<Provider, { apiUrl: string; model: string }> = {
  openai: { apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-6-luna' },
  claude: { apiUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-5-5' },
  gemini: { apiUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.8-flash' },
  custom: { apiUrl: '', model: '' },
};
const providerNames: Record<Provider, string> = { openai: 'GPT', claude: 'Claude', gemini: 'Gemini', custom: '커스텀 API' };
const app = express();
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = new Set([process.env.FRONTEND_ORIGIN || 'http://localhost:5173']);
if (isDev) { allowedOrigins.add('http://127.0.0.1:5173'); allowedOrigins.add('http://localhost:5173'); }
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)) }));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: '허용되지 않은 출처입니다.' });
  next();
});

function activeSettings(): ProviderSettings {
  const raw = process.env.AI_PROVIDER || 'openai';
  const provider = providers.includes(raw as Provider) ? raw as Provider : 'openai';
  const fallback = defaults[provider];
  return {
    provider,
    apiKey: Object.hasOwn(process.env, 'AI_API_KEY') ? process.env.AI_API_KEY || '' : (provider === 'openai' ? process.env.OPENAI_API_KEY || '' : ''),
    apiUrl: process.env.AI_API_URL || (provider === 'openai' ? process.env.OPENAI_API_URL : '') || fallback.apiUrl,
    model: process.env.AI_MODEL || (provider === 'openai' ? process.env.OPENAI_MODEL : '') || fallback.model,
  };
}
function publicSettings() {
  const settings = activeSettings();
  return { configured: Boolean(settings.apiKey), provider: settings.provider, apiUrl: settings.apiUrl, model: settings.model, dailyLimit: getDailyLimit(), usedToday: dailyCount, accessRequired: Boolean(process.env.APP_ACCESS_TOKEN) };
}
function requireAccess(req: Request, res: Response, next: () => void) {
  const expected = process.env.APP_ACCESS_TOKEN;
  if (!expected) return next();
  const provided = req.get('x-app-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return res.status(401).json({ error: '서버 접근 코드가 올바르지 않습니다.' });
  return next();
}
function validateApiUrl(value: string, provider: Provider): string | undefined {
  if (!value || value.length > 2000) return 'API 주소를 입력해 주세요.';
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return 'API 주소에 인증 정보를 넣지 말고 API 키 입력란을 사용해 주세요.';
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) return 'API 주소는 HTTPS를 사용해 주세요.';
    if (provider === 'custom' && !parsed.pathname.endsWith('/chat/completions')) return '커스텀 API는 OpenAI 호환 Chat Completions 주소를 사용해 주세요.';
  } catch { return 'API 주소 형식이 올바르지 않습니다.'; }
}
function writeLocalSettings(settings: ProviderSettings, dailyLimit: number) {
  const file = resolve(root, '.env.local');
  const values: Record<string, string> = {
    AI_PROVIDER: settings.provider,
    AI_API_KEY: settings.apiKey,
    AI_API_URL: settings.apiUrl,
    AI_MODEL: settings.model,
    AI_DAILY_CALL_LIMIT: String(dailyLimit),
  };
  let lines: string[] = [];
  try { lines = readFileSync(file, 'utf8').split(/\r?\n/); } catch { /* First run: create the local-only config file. */ }
  for (const [key, value] of Object.entries(values)) {
    const encoded = `${key}=${JSON.stringify(value)}`;
    const index = lines.findIndex(line => new RegExp(`^\\s*${key}\\s*=`).test(line));
    if (index >= 0) lines[index] = encoded;
    else lines.push(encoded);
  }
  writeFileSync(file, `${lines.filter((line, index, all) => index < all.length - 1 || line !== '').join('\n').trimEnd()}\n`, { encoding: 'utf8', mode: 0o600 });
}

const usageFile = resolve(root, '.ai-usage.json');
const todayKorea = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let dailyDate = todayKorea();
let dailyCount = 0;
try {
  const usage = JSON.parse(readFileSync(usageFile, 'utf8')) as { date?: string; count?: number };
  if (usage.date === dailyDate && Number.isFinite(usage.count)) dailyCount = Math.max(0, Number(usage.count));
} catch { /* No usage record on first run. */ }
function getDailyLimit() {
  const limit = Number(process.env.AI_DAILY_CALL_LIMIT || 50);
  return Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.floor(limit))) : 50;
}
const minuteBuckets = new Map<string, { since: number; count: number }>();
function reserveAIRequest(req: Request, res: Response) {
  const now = Date.now();
  const date = todayKorea();
  if (dailyDate !== date) { dailyDate = date; dailyCount = 0; }
  const ip = req.ip || req.socket.remoteAddress || 'local';
  let bucket = minuteBuckets.get(ip);
  if (!bucket || now - bucket.since >= 60_000) { bucket = { since: now, count: 0 }; minuteBuckets.set(ip, bucket); }
  if (bucket.count >= 6) { res.status(429).json({ error: '요청이 잠시 많습니다. 1분 뒤 다시 시도해 주세요.', usedToday: dailyCount }); return false; }
  if (dailyCount >= getDailyLimit()) { res.status(429).json({ error: '오늘 설정한 AI 호출 한도에 도달했습니다. 서버 설정에서 한도를 높이거나 내일 다시 이용해 주세요.', usedToday: dailyCount }); return false; }
  bucket.count += 1; dailyCount += 1;
  try { writeFileSync(usageFile, JSON.stringify({ date: dailyDate, count: dailyCount }), { encoding: 'utf8', mode: 0o600 }); } catch { /* Keep in-memory guard active if the local counter cannot be persisted. */ }
  return true;
}

const systemPrompt = '당신은 한국 직장인을 위한 업무 문구 작성 도우미입니다. 입력된 사실만 사용하고 누락된 날짜, 이름, 사유, 성과, 약속을 절대 추측하거나 만들지 마세요. 자연스럽고 상황에 맞는 한국어 문장을 작성합니다. 이메일은 제목과 본문을, 메신저는 간결한 문장을 작성하세요. 수신자 말투: manager=상사에게 정중하게, colleague=동료에게 부드럽고 간결하게, external=외부 회사에 공식적이고 격식 있게. tone 값이 formal이면 더 정중하게, short면 더 짧게, soft면 더 부드럽게 씁니다. 요청된 경우 subject, email, chat 키를 가진 JSON 객체만 반환하세요.';
async function callProvider(settings: ProviderSettings, prompt: string, testOnly = false): Promise<string> {
  const userMessage = testOnly ? '연결 테스트입니다. 정확히 OK라고만 답하세요.' : prompt;
  const base = settings.apiUrl.replace(/\/$/, '');
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;
  if (settings.provider === 'gemini') {
    url = `${base}/models/${encodeURIComponent(settings.model)}:generateContent`;
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey };
    body = { systemInstruction: { parts: [{ text: testOnly ? 'Reply only with OK.' : systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: userMessage }] }], generationConfig: { responseMimeType: testOnly ? 'text/plain' : 'application/json', maxOutputTokens: testOnly ? 16 : 900 } };
  } else if (settings.provider === 'claude') {
    url = settings.apiUrl;
    headers = { 'Content-Type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' };
    body = { model: settings.model, max_tokens: testOnly ? 16 : 900, system: testOnly ? 'Reply only with OK.' : systemPrompt, messages: [{ role: 'user', content: userMessage }] };
  } else {
    url = settings.apiUrl;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` };
    body = { model: settings.model, messages: [{ role: 'system', content: testOnly ? 'Reply only with OK.' : systemPrompt }, { role: 'user', content: userMessage }], max_completion_tokens: testOnly ? 16 : 900, ...(testOnly ? {} : { response_format: { type: 'json_object' } }) };
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`제공자 응답 오류 (${response.status}). API 키, 모델 이름, 주소를 확인해 주세요.`);
  const payload = await response.json() as {
    choices?: { message?: { content?: string } }[];
    content?: { type?: string; text?: string }[];
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (settings.provider === 'gemini') return payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  if (settings.provider === 'claude') return payload.content?.filter(part => part.type === 'text').map(part => part.text || '').join('') || '';
  return payload.choices?.[0]?.message?.content || '';
}
function parseDraft(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI 응답이 JSON 형식이 아닙니다. 다시 시도해 주세요.');
  const result = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  if (![result.subject, result.email, result.chat].every(value => typeof value === 'string' && value.length > 0 && value.length <= 12_000)) throw new Error('AI 응답의 문구 형식이 올바르지 않습니다.');
  return { subject: result.subject, email: result.email, chat: result.chat };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, aiEnabled: Boolean(activeSettings().apiKey) }));
app.get('/api/access', (_req, res) => res.json({ required: Boolean(process.env.APP_ACCESS_TOKEN) }));
app.use('/api/settings', requireAccess);
app.use('/api/generate', requireAccess);
app.get('/api/settings', (_req, res) => res.json(publicSettings()));
app.delete('/api/settings', (_req, res) => {
  const current = activeSettings();
  try { writeLocalSettings({ ...current, apiKey: '' }, getDailyLimit()); }
  catch { return res.status(500).json({ error: 'API 키 설정을 삭제하지 못했어요.' }); }
  process.env.AI_API_KEY = '';
  return res.json(publicSettings());
});
app.post('/api/settings', (req, res) => {
  const current = activeSettings();
  const provider = providers.includes(req.body?.provider) ? req.body.provider as Provider : current.provider;
  const changedProvider = provider !== current.provider;
  const apiKey = typeof req.body?.apiKey === 'string' && req.body.apiKey.trim() ? req.body.apiKey.trim() : changedProvider ? '' : current.apiKey;
  const defaultsForProvider = defaults[provider];
  const apiUrl = typeof req.body?.apiUrl === 'string' ? req.body.apiUrl.trim() : '';
  const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
  const settings: ProviderSettings = { provider, apiKey, apiUrl: apiUrl || defaultsForProvider.apiUrl, model: model || defaultsForProvider.model };
  const validationError = validateApiUrl(settings.apiUrl, provider);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!settings.apiKey) return res.status(400).json({ error: '선택한 제공자의 API 키를 입력해 주세요.' });
  if (!settings.model || settings.model.length > 120) return res.status(400).json({ error: '모델 이름을 확인해 주세요.' });
  const requestedLimit = Number(req.body?.dailyLimit || process.env.AI_DAILY_CALL_LIMIT || 50);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 500) return res.status(400).json({ error: '일일 AI 호출 한도는 1~500 사이로 입력해 주세요.' });
  try { writeLocalSettings(settings, requestedLimit); }
  catch { return res.status(500).json({ error: '서버 설정 파일을 저장하지 못했어요. 파일 권한과 디스크 공간을 확인해 주세요.' }); }
  process.env.AI_PROVIDER = settings.provider;
  process.env.AI_API_KEY = settings.apiKey;
  process.env.AI_API_URL = settings.apiUrl;
  process.env.AI_MODEL = settings.model;
  process.env.AI_DAILY_CALL_LIMIT = String(requestedLimit);
  return res.json(publicSettings());
});
app.post('/api/settings/test', async (req, res) => {
  const current = activeSettings();
  const provider = providers.includes(req.body?.provider) ? req.body.provider as Provider : current.provider;
  const changedProvider = provider !== current.provider;
  const settings: ProviderSettings = {
    provider,
    apiKey: typeof req.body?.apiKey === 'string' && req.body.apiKey.trim() ? req.body.apiKey.trim() : changedProvider ? '' : current.apiKey,
    apiUrl: typeof req.body?.apiUrl === 'string' && req.body.apiUrl.trim() ? req.body.apiUrl.trim() : changedProvider ? defaults[provider].apiUrl : current.apiUrl,
    model: typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim() : changedProvider ? defaults[provider].model : current.model,
  };
  const validationError = validateApiUrl(settings.apiUrl, provider);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!settings.apiKey) return res.status(400).json({ error: 'API 키를 입력해 주세요.' });
  if (!settings.model) return res.status(400).json({ error: '모델 이름을 입력해 주세요.' });
  if (!reserveAIRequest(req, res)) return;
  try {
    const result = await callProvider(settings, '', true);
    if (!result.trim()) throw new Error('응답이 비어 있습니다.');
    return res.json({ ok: true, provider: providerNames[provider], usedToday: dailyCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : '연결에 실패했습니다.';
    return res.status(502).json({ error: message, usedToday: dailyCount });
  }
});
app.post('/api/generate', async (req, res) => {
  const { scenario, audience, fields, tone } = req.body ?? {};
  const settings = activeSettings();
  if (!settings.apiKey) return res.status(503).json({ error: 'AI가 설정되지 않았습니다.' });
  if (typeof scenario !== 'string' || typeof audience !== 'string' || !['manager', 'colleague', 'external'].includes(audience) || !['연차·병가 신청', '업무 보고', '일정 조율', '자료 요청'].includes(scenario) || typeof fields !== 'object' || fields === null || Array.isArray(fields)) return res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
  const safeFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields).slice(0, 20)) {
    if (typeof value !== 'string' || value.length > 4000) return res.status(400).json({ error: '입력 항목은 각각 4,000자 이내로 작성해 주세요.' });
    safeFields[key] = value;
  }
  if (JSON.stringify(safeFields).length > 12_000) return res.status(400).json({ error: '입력 내용이 너무 깁니다.' });
  if (!reserveAIRequest(req, res)) return;
  try {
    const text = await callProvider(settings, JSON.stringify({ scenario, audience, fields: safeFields, tone: typeof tone === 'string' ? tone : 'normal' }));
    return res.json({ ...parseDraft(text), usedToday: dailyCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 문구를 작성하지 못했습니다.';
    return res.status(502).json({ error: message });
  }
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`AI proxy listening on http://${host}:${port}`));
