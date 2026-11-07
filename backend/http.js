import { createServer } from 'node:http';
import { ApiError } from './errors.js';

const cookieName = 'windowsill_guest';

function guestCookie(request) {
  return request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
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

export function createApi({ games, shelves, origins, secureCookie = false }) {
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
      if (method === 'POST' && path === '/api/session') {
        await jsonBody(request);
        const session = await games.session(guestCookie(request));
        response.setHeader('Set-Cookie', `${cookieName}=${session.token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=31536000${secureCookie ? '; Secure' : ''}`);
        return send(session.created ? 201 : 200, { ready: true });
      }
      if (method === 'GET' && path === '/api/neighbors') return send(200, { gardens: await shelves.publicList() });
      const player = await games.playerFor(guestCookie(request));
      const share = /^\/api\/shelves\/([^/]+)(\/like)?$/.exec(path);
      if (method === 'GET' && share && !share[2]) return send(200, { garden: await shelves.get(share[1], player) });
      const like = share?.[2] && ['PUT', 'DELETE'].includes(method);
      if (like || (method === 'GET' && path === '/api/garden') || (method === 'POST' && path === '/api/garden/actions')) {
        if (!player) throw new ApiError(401, '需要先建立试玩会话。');
        if (like) return send(200, { garden: await shelves.like(share[1], player, method === 'PUT') });
        const result = await games.game(player, method === 'POST' ? await jsonBody(request) : null);
        return send(200, result);
      }
      throw new ApiError(404, '找不到这个接口。');
    } catch (error) {
      if (error instanceof ApiError) return send(error.status, { error: error.message });
      console.error('API request failed:', error);
      return send(500, { error: '花园服务暂时不可用，请稍后重试。' });
    }
  });
}
