import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { migrate, openDatabase } from '../backend/database.js';
import { createAuthService } from '../backend/auth-service.js';
import { createGameService } from '../backend/game-service.js';
import { createShelfService } from '../backend/shelf-service.js';
import { salePrice } from '../shared/simulation.js';

const startedAt = 1_780_000_000_000;
const submit = (service, player, action, requestId = randomUUID()) => service.game(player, { action, requestId });

test('后端收到多个停止信号时只关闭数据库一次', async () => {
  const script = `
    await import('./backend/start.js');
    process.emit('SIGINT');
    process.emit('SIGTERM');
    process.emit('SIGINT');
  `;
  const { stderr } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: '',
      PLANT_DB_DIR: 'memory://',
      PLANT_API_HOST: '127.0.0.1',
      PLANT_API_PORT: '0',
    },
    timeout: 30_000,
  });
  assert.equal(stderr, '');
});

test('联机成长、交易幂等与花架权限使用关系数据库', async () => {
  const database = await openDatabase({ url: '', directory: 'memory://' });
  try {
    await migrate(database);
    await migrate(database);
    let now = startedAt;
    const auth = createAuthService(database, { clock: () => now });
    const games = createGameService(database, { fastForward: true, clock: () => now });
    const shelves = createShelfService(database);
    const session = await auth.ensure({});
    assert.equal((await auth.ensure({ guest: session.token })).created, false);
    assert.equal(await auth.resolveSession({ guest: 'forged' }), null);
    const owner = session.playerId;
    const visitor = (await auth.ensure({})).playerId;
    const { state: initial } = await games.game(owner);
    const plant = initial.slots.left.plant.id;
    assert.equal(initial.coins, 86);
    assert.equal((await games.game(visitor)).state.shelf.length, 0);
    await submit(games, visitor, { type: 'water', slot: 'left', expectedId: plant });
    assert.equal((await games.game(owner)).state.slots.left.plant.moisture, 58);

    now += 90_000;
    const { state: matured } = await games.game(owner);
    assert.ok(matured.slots.left.plant.quality > 0);
    assert.equal(matured.album.chamomile.count, 1);
    const { state: displayed } = await submit(games, owner, { type: 'display', slot: 'left', expectedId: plant });
    assert.equal(displayed.shelf[0].id, plant);
    const { state: shared } = await submit(games, owner, { type: 'publish', visibility: 'unlisted' });
    const token = shared.sharing.token;
    assert.equal((await shelves.get(token, visitor)).plants.length, 1);
    assert.ok(!(await shelves.publicList()).some((entry) => entry.token === token));
    await assert.rejects(shelves.like(token, owner, true), { status: 403 });
    await shelves.like(token, visitor, true);
    assert.equal((await shelves.like(token, visitor, true)).likes, 1);
    await submit(games, owner, { type: 'publish', visibility: 'public' });
    assert.ok((await shelves.publicList()).some((entry) => entry.token === token));

    const sale = { type: 'sell', expectedId: plant };
    const request = randomUUID();
    const [first, replay] = await Promise.all([submit(games, owner, sale, request), submit(games, owner, sale, request)]);
    assert.equal(first.message, replay.message);
    assert.equal(replay.state.coins, displayed.coins + salePrice(displayed.shelf[0]) + 10);
    assert.equal(replay.state.stats.sold, 1);
    assert.equal(replay.state.album.chamomile.count, 1);
    assert.equal((await shelves.get(token, visitor)).plants.length, 0);
    await assert.rejects(submit(games, owner, { type: 'wait' }, request), { status: 409 });
    await submit(games, owner, { type: 'unpublish' });
    await assert.rejects(shelves.get(token, visitor), { status: 404 });

    const purchase = { type: 'plant', slot: 'left', species: 'lavender', pot: 'glaze', seed: 123, coins: 0 };
    const planted = await submit(games, owner, purchase);
    assert.equal(planted.plantedId, planted.state.slots.left.plant.id);
    assert.equal(planted.state.coins, replay.state.coins - 40);
    const { rows: [ledger] } = await database.query('SELECT sum(delta) AS balance FROM windowsill.leaf_ledger WHERE player_id=$1', [owner]);
    assert.equal(Number(ledger.balance), planted.state.coins);
    assert.equal((await submit(games, owner, { type: 'water', slot: 'left', expectedId: plant })).state.slots.left.plant.moisture, 58);
    const production = createGameService(database, { fastForward: false });
    await assert.rejects(submit(production, owner, { type: 'wait' }), { status: 400 });
  } finally { await database.close(); }
});

test('接入已手动初始化的数据库，并在服务重开后登录恢复存档', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'windowsill-db-'));
  let database;
  try {
    database = await openDatabase({ url: '', directory });
    for (const file of ['001_initial_schema.sql', '002_seed_demo_catalog.sql']) {
      const sql = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
      await database.transaction((tx) => tx.exec(sql.replace(/^\s*BEGIN;\s*/, '').replace(/\s*COMMIT;\s*$/, '')));
    }
    await migrate(database);
    const auth = createAuthService(database, { clock: () => startedAt });
    const games = createGameService(database, { clock: () => startedAt });
    const { token, playerId: player } = await auth.ensure({});
    const { state } = await submit(games, player, { type: 'unlock', slot: 'right' });
    const fields = { username: 'garden_reopen', password: 'Spring garden at dusk' };
    await auth.register(fields, { guest: token });
    await database.close();
    database = null;
    database = await openDatabase({ url: '', directory });
    await migrate(database);
    const restarted = createGameService(database, { clock: () => startedAt });
    const resumedAuth = createAuthService(database, { clock: () => startedAt });
    const member = await resumedAuth.login(fields, {});
    assert.equal((await resumedAuth.resolveSession({ member: member.token })).playerId, player);
    const { state: restored } = await restarted.game(player);
    assert.equal(restored.gardenId, state.gardenId);
    assert.equal(restored.coins, 48);
    assert.equal(restored.slots.right.unlocked, true);
  } finally {
    await database?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
