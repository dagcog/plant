import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { ACCOUNT_SECONDS, GUEST_SECONDS } from './auth-service.js';
import { ApiError } from './errors.js';

const guestName = 'windowsill_guest';
const memberName = 'windowsill_session';
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function readCookies(request) {
  const values = (request.headers.cookie ?? '').split(';').map((part) => part.trim());
  const value = (name) => values.find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return { guest: value(guestName), member: value(memberName) };
}

function authGate() {
  const attempts = new Map();
  const windowMs = 10 * 60 * 1000;
  let active = 0;
  return async (address, run) => {
    const now = Date.now();
    if (attempts.size >= 2048) for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const previous = attempts.get(address);
    const entry = previous?.until > now ? previous : { until: now + windowMs, count: 0 };
    if (entry.count >= 20 || (!previous && attempts.size >= 2048)) {
      throw new ApiError(429, '尝试次数过多，请稍后再试。');
    }
    if (active >= 4) throw new ApiError(429, '当前登录请求较多，请稍后重试。');
    entry.count++;
    attempts.set(address, entry);
    active++;
    try { return await run(); }
    finally { active--; }
  };
}

async function jsonBody(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new ApiError(415, '请提交 JSON。');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new ApiError(413, '请求内容太大。');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('object required');
    return data;
  } catch { throw new ApiError(400, '请求不是有效的 JSON 对象。'); }
}

export function createApi({ auth, games, shelves, origins, secureCookie = false, trustLoopbackProxy = false }) {
  const limitAuth = authGate();
  const cookie = (name, token, maxAge) => `${name}=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    response.setHeader('Vary', 'Origin');
    const send = (status, body) => response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    try {
      if (origin && !origins.has(origin)) throw new ApiError(403, '此站点无权访问花园服务。');
      if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }).end();
        return;
      }
      const path = new URL(request.url, 'http://localhost').pathname;
      const method = request.method;
      if (method === 'GET' && path === '/api/health') return send(200, { ok: true });
      const cookies = readCookies(request);
      if (method === 'POST' && path === '/api/session') {
        await jsonBody(request);
        const session = await auth.ensure(cookies);
        if (session.created) response.setHeader('Set-Cookie', cookie(guestName, session.token, GUEST_SECONDS));
        return send(session.created ? 201 : 200, { ready: true, account: session.account });
      }
      if (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login')) {
        const input = await jsonBody(request);
        const register = path.endsWith('/register');
        const peer = request.socket.remoteAddress;
        const forwarded = request.headers['x-real-ip'];
        const address = trustLoopbackProxy && loopback.has(peer) && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : peer;
        const session = await limitAuth(address, () => register ? auth.register(input, cookies) : auth.login(input, cookies));
        const setCookies = [cookie(memberName, session.token, ACCOUNT_SECONDS)];
        if (register) setCookies.push(cookie(guestName, '', 0));
        response.setHeader('Set-Cookie', setCookies);
        return send(register ? 201 : 200, { account: session.account });
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        await jsonBody(request);
        await auth.logout(cookies.member);
        response.setHeader('Set-Cookie', cookie(memberName, '', 0));
        return send(200, { account: null });
      }
      if (method === 'GET' && path === '/api/neighbors') return send(200, { gardens: await shelves.publicList() });
      const identity = await auth.resolveSession(cookies);
      const player = identity?.playerId ?? null;
      const share = /^\/api\/shelves\/([^/]+)(\/like)?$/.exec(path);
      if (method === 'GET' && share && !share[2]) return send(200, { garden: await shelves.get(share[1], player) });
      const like = share?.[2] && ['PUT', 'DELETE'].includes(method);
      if (like || (method === 'GET' && path === '/api/garden') || (method === 'POST' && path === '/api/garden/actions')) {
        if (!player) throw new ApiError(401, '需要先建立试玩会话。');
        if (like) return send(200, { garden: await shelves.like(share[1], player, method === 'PUT') });
        const result = await games.game(player, method === 'POST' ? await jsonBody(request) : null,
          async (tx) => (await auth.resolveSession(cookies, tx))?.playerId === player);
        return send(200, { ...result, account: identity.account });
      }
      throw new ApiError(404, '找不到这个接口。');
    } catch (error) {
      if (error instanceof ApiError) return send(error.status, { error: error.message });
      console.error('API request failed:', error);
      return send(500, { error: '花园服务暂时不可用，请稍后重试。' });
    }
  });
}
