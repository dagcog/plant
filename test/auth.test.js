import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ACCOUNT_SECONDS, createAuthService } from '../backend/auth-service.js';
import { migrate, openDatabase } from '../backend/database.js';
import { createGameService } from '../backend/game-service.js';

test('注册继承访客窗台，登录隔离会话，退出和到期回收权限', async () => {
  const db = await openDatabase({ url: '', directory: 'memory://' });
  try {
    await migrate(db);
    const grants = await readFile(new URL('../deploy/postgres-runtime.sql', import.meta.url), 'utf8');
    await db.transaction((tx) => tx.exec(`CREATE ROLE windowsill_app NOLOGIN;
      ${grants.replace(/^\s*BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '')}`));
    await db.query('SET ROLE windowsill_app');
    let now = 1_780_000_000_000;
    const auth = createAuthService(db, { clock: () => now });
    const games = createGameService(db, { clock: () => now });
    const original = await auth.ensure({});
    const other = await auth.ensure({});
    const garden = await games.game(original.playerId, {
      requestId: randomUUID(), action: { type: 'plant', slot: 'middle', species: 'lavender', pot: 'glaze' },
    });
    const originalCookie = { guest: original.token };
    const fields = { username: 'Window_Owner', password: 'Fresh air by the window' };
    await assert.rejects(auth.register({ ...fields, password: 'short' }, originalCookie), { status: 400 });
    const registered = await auth.register(fields, originalCookie);
    assert.equal(registered.account.username, 'window_owner');
    assert.equal(await auth.resolveSession(originalCookie), null);
    assert.equal((await auth.resolveSession({ member: registered.token })).playerId, original.playerId);
    await assert.rejects(games.game(original.playerId, null, async (tx) => Boolean(await auth.resolveSession(originalCookie, tx))), { status: 401 });
    await assert.rejects(auth.register(fields, { guest: other.token }), { status: 409 });
    assert.equal((await auth.resolveSession({ guest: other.token })).playerId, other.playerId);
    await assert.rejects(auth.login({ ...fields, password: 'incorrect password' }, {}), { status: 401, message: '用户名或密码不正确。' });
    await assert.rejects(auth.login({ ...fields, username: 'nobody_here' }, {}), { status: 401, message: '用户名或密码不正确。' });

    const credentials = await db.query('SELECT username,password_salt,password_digest FROM windowsill.accounts');
    assert.equal(credentials.rows.length, 1);
    assert.match(credentials.rows[0].password_digest, /^[0-9a-f]{64}$/);
    assert.match(credentials.rows[0].password_salt, /^[0-9a-f]{32}$/);
    const signIn = await auth.login(fields, { guest: other.token });
    const identity = await auth.resolveSession({ member: signIn.token, guest: other.token });
    const restored = await games.game(identity.playerId);
    assert.equal(restored.state.gardenId, garden.state.gardenId);
    assert.equal(restored.state.slots.middle.plant.id, garden.plantedId);
    assert.equal(restored.state.coins, 46);
    await assert.rejects(db.query('UPDATE windowsill.wallets SET balance=9999 WHERE player_id=$1', [identity.playerId]), { code: '42501' });

    const rotated = await auth.login(fields, { member: signIn.token });
    assert.equal(await auth.resolveSession({ member: signIn.token }), null);
    await auth.logout(rotated.token);
    assert.equal(await auth.resolveSession({ member: rotated.token }), null);
    assert.equal((await auth.resolveSession({ guest: other.token })).playerId, other.playerId);
    assert.ok(await auth.resolveSession({ member: registered.token }));
    now += ACCOUNT_SECONDS * 1000;
    assert.equal(await auth.resolveSession({ member: registered.token }), null);
  } finally { await db.close(); }
});
