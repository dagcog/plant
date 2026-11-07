import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from './errors.js';
import { initializeGuest } from './garden-repository.js';

export const GUEST_SECONDS = 365 * 24 * 60 * 60;
export const ACCOUNT_SECONDS = 7 * 24 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const usernamePattern = /^[a-z0-9_]{3,32}$/;
const derive = promisify(scrypt);
const scryptParams = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummySalt = randomBytes(16);
const dummyDigest = randomBytes(32);
const freshToken = () => randomBytes(32).toString('base64url');
const timestamp = (ms) => new Date(ms).toISOString();

function tokenDigest(token) {
  return typeof token === 'string' && tokenPattern.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}

function credentials(input, registering) {
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' && input.password.length <= 256 ? input.password : '';
  const length = [...password].length;
  if (registering) {
    if (!usernamePattern.test(username)) throw new ApiError(400, '用户名需为 3–32 个英文字母、数字或下划线。');
    if (length < 15 || length > 128) throw new ApiError(400, '密码需为 15–128 个字符。');
  } else if (!usernamePattern.test(username) || !length || length > 128) {
    throw new ApiError(401, '用户名或密码不正确。');
  }
  return { username, password };
}

async function guestFor(db, token, lock = false) {
  const digest = tokenDigest(token);
  if (!digest) return null;
  const { rows } = await db.query(`SELECT id FROM windowsill.players
    WHERE auth_issuer='guest' AND auth_subject=$1${lock ? ' FOR UPDATE' : ''}`, [digest]);
  return rows[0]?.id ?? null;
}

async function openSession(tx, playerId, now) {
  const token = freshToken();
  await tx.query('DELETE FROM windowsill.account_sessions WHERE player_id=$1 AND expires_at <= $2', [playerId, timestamp(now)]);
  await tx.query(`INSERT INTO windowsill.account_sessions (token_digest,player_id,created_at,expires_at)
    VALUES ($1,$2,$3,$4)`, [tokenDigest(token), playerId, timestamp(now), timestamp(now + ACCOUNT_SECONDS * 1000)]);
  return token;
}

export function createAuthService(database, { clock = Date.now } = {}) {
  async function accountFor(db, token) {
    const digest = tokenDigest(token);
    if (!digest) return null;
    const { rows: [row] } = await db.query(`SELECT a.player_id,a.username FROM windowsill.account_sessions s
      JOIN windowsill.accounts a USING (player_id) WHERE s.token_digest=$1 AND s.expires_at>$2`, [digest, timestamp(clock())]);
    return row ? { playerId: row.player_id, account: { username: row.username } } : null;
  }

  async function resolveSession(cookies, db = database) {
    const member = await accountFor(db, cookies.member);
    if (member) return member;
    const playerId = await guestFor(db, cookies.guest);
    return playerId ? { playerId, account: null } : null;
  }

  async function ensure(cookies) {
    const identity = await resolveSession(cookies);
    if (identity) return { ...identity, created: false };
    const token = freshToken();
    const playerId = await database.transaction((tx) => initializeGuest(tx, tokenDigest(token), clock()));
    return { playerId, account: null, token, created: true };
  }

  async function register(input, cookies) {
    if (await accountFor(database, cookies.member)) throw new ApiError(409, '请先退出当前账号。');
    const { username, password } = credentials(input, true);
    const salt = randomBytes(16);
    const digest = await derive(password, salt, 32, scryptParams);
    return database.transaction(async (tx) => {
      const now = clock();
      let playerId = await guestFor(tx, cookies.guest, true);
      if (!playerId && tokenDigest(cookies.guest)) throw new ApiError(409, '访客会话已变更，请刷新页面后重试。');
      if (!playerId) playerId = await initializeGuest(tx, tokenDigest(freshToken()), now);
      const { rows } = await tx.query(`INSERT INTO windowsill.accounts (player_id,username,password_salt,password_digest)
        VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO NOTHING RETURNING player_id`,
      [playerId, username, salt.toString('hex'), digest.toString('hex')]);
      if (!rows.length) throw new ApiError(409, '这个用户名已被使用。');
      // Keep the player's garden, wallet and likes while retiring the guest token.
      await tx.query("UPDATE windowsill.players SET auth_issuer='local',auth_subject=id::text WHERE id=$1", [playerId]);
      return { token: await openSession(tx, playerId, now), account: { username } };
    });
  }

  async function login(input, cookies) {
    const { username, password } = credentials(input, false);
    const { rows: [row] } = await database.query(`SELECT player_id,password_salt,password_digest FROM windowsill.accounts
      WHERE username=$1`, [username]);
    const salt = row ? Buffer.from(row.password_salt, 'hex') : dummySalt;
    const digest = await derive(password, salt, 32, scryptParams);
    const matches = timingSafeEqual(digest, row ? Buffer.from(row.password_digest, 'hex') : dummyDigest);
    if (!row || !matches) throw new ApiError(401, '用户名或密码不正确。');
    return database.transaction(async (tx) => {
      if (tokenDigest(cookies.member)) await tx.query('DELETE FROM windowsill.account_sessions WHERE token_digest=$1', [tokenDigest(cookies.member)]);
      return { token: await openSession(tx, row.player_id, clock()), account: { username } };
    });
  }

  async function logout(token) {
    const digest = tokenDigest(token);
    if (digest) await database.query('DELETE FROM windowsill.account_sessions WHERE token_digest=$1', [digest]);
  }

  return { resolveSession, ensure, register, login, logout };
}
