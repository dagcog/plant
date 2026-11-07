const base = (globalThis.WINDOWSILL_API_BASE ?? '/api').replace(/\/$/, '');

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, credentials: 'include', signal: AbortSignal.timeout(10000),
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || '花园服务不可用。'), { status: response.status });
  return data;
}

export function createApiStore() {
  let queue = Promise.resolve();
  let hasSession = false;

  async function transact(action) {
    if (!hasSession) {
      await call('/session', { method: 'POST', body: {} });
      hasSession = true;
    }
    if (!action) return call('/garden');
    const body = { requestId: crypto.randomUUID(), action };
    try { return await call('/garden/actions', { method: 'POST', body }); }
    catch (error) {
      if (error.status) throw error;
      return call('/garden/actions', { method: 'POST', body });
    }
  }

  return {
    run(action) {
      const result = queue.then(() => transact(action));
      queue = result.catch((error) => { if (error.status === 401) hasSession = false; });
      return result;
    },
  };
}

export const neighbors = async () => (await call('/neighbors')).gardens;
export const readShelf = async (token) => (await call(`/shelves/${encodeURIComponent(token)}`)).garden;
export const setLike = async (token, liked) => (await call(`/shelves/${encodeURIComponent(token)}/like`, { method: liked ? 'PUT' : 'DELETE' })).garden;
