import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACHIEVEMENTS, OFFLINE_CAP, POTS, SHELF_LIMIT, SPECIES } from '../shared/content.js';
import { advance, applyAction, catchUp, createGame, phaseAt, plantFrom, salePrice, seeded, sunlight } from '../shared/simulation.js';
import { decodeSave } from '../shared/storage.js';
import { readShare, shareURL } from '../shared/sharing.js';

const id = 'a'.repeat(36);
const fresh = () => createGame(1700000000000, id);

test('种植位、盆器和种子的校验先于扣款', () => {
  const state = fresh();
  const plant = { type: 'plant', slot: 'middle', species: 'lavender', pot: 'glaze', seed: 19 };
  for (const invalid of [{ ...plant, slot: 'right' }, { ...plant, slot: 'left' }, { ...plant, species: 'unknown' }]) applyAction(state, invalid);
  assert.equal(state.coins, 86);
  applyAction(state, plant);
  const remaining = 86 - SPECIES.lavender.price - POTS.glaze.price;
  assert.equal(state.coins, remaining);
  assert.equal(state.slots.middle.plant.seed, 19);
  applyAction(state, plant);
  assert.equal(state.coins, remaining);
  applyAction(state, { type: 'unlock', slot: 'right' });
  assert.equal(state.slots.right.unlocked, false);
});

test('三段光照按时间推进，光照依赖位置和养护', () => {
  const state = fresh();
  assert.equal(phaseAt(state.time).id, 'morning');
  assert.ok(sunlight(state.time, 'middle', 1) > sunlight(state.time, 'right', 1));
  assert.ok(sunlight(state.time, 'middle', 2) > sunlight(state.time, 'middle', 0));
  applyAction(state, { type: 'phase', id: 'noon' });
  assert.equal(state.time, 80);
  applyAction(state, { type: 'phase', id: 'evening' });
  assert.equal(state.time, 160);
  applyAction(state, { type: 'phase', id: 'morning' });
  assert.equal(state.time, 240);
});

test('水分、养分、光照与盆器影响累积生长，失养仍能成熟', () => {
  const start = () => {
    const state = fresh();
    state.slots.left.plant = null;
    state.slots.middle.plant = plantFrom('lavender', 'clay', 17);
    return state;
  };
  const cared = start();
  const neglected = start();
  const slowDrain = start();
  slowDrain.slots.middle.plant.pot = 'porcelain';
  advance(cared, 20);
  advance(slowDrain, 20);
  assert.ok(slowDrain.slots.middle.plant.moisture > cared.slots.middle.plant.moisture);
  Object.assign(neglected.slots.middle.plant, { moisture: 0, nutrition: 0, exposure: 0 });
  advance(cared, 180);
  advance(neglected, 200);
  assert.equal(cared.slots.middle.plant.growth, 1);
  assert.equal(neglected.slots.middle.plant.growth, 1);
  assert.ok(cared.slots.middle.plant.quality > neglected.slots.middle.plant.quality);
});

test('异色可复现且图鉴与里程碑只结算一次', () => {
  const state = fresh();
  let seed = 0;
  while (seeded(seed, 31415) >= 0.05) seed++;
  state.slots.left.plant.seed = seed;
  advance(state, 200);
  const specimen = structuredClone(state.slots.left.plant);
  assert.equal(specimen.rare, true);
  assert.equal(state.album.chamomile.rare, 1);
  assert.equal(state.coins, 86 + ACHIEVEMENTS.bloom.reward + ACHIEVEMENTS.rare.reward);
  advance(state, 1000);
  assert.deepEqual(state.slots.left.plant, specimen);
  assert.equal(state.album.chamomile.count, 1);
});

test('离线补算与前台一致，保留毫秒余量并限制上限', () => {
  const state = fresh();
  const baseline = fresh();
  const wall = state.wall;
  assert.equal(catchUp(state, wall - 1000), false);
  assert.equal(catchUp(state, wall + 69123), true);
  advance(baseline, 69);
  assert.deepEqual(state.slots, baseline.slots);
  assert.equal(state.wall, wall + 69000);
  catchUp(state, wall + 10_000_000);
  assert.equal(state.time, 18 + 69 + OFFLINE_CAP);
  assert.equal(catchUp(state, wall + 10_000_000), false);
});

test('花架已满时保留盆栽，售卖与上架互斥，旧交互不能售卖新对象', () => {
  const state = fresh();
  advance(state, 300);
  const plant = state.slots.left.plant;
  const specimen = { species: plant.species, pot: plant.pot, seed: plant.seed, quality: plant.quality, rare: plant.rare };
  state.shelf = Array.from({ length: SHELF_LIMIT }, (_, index) => ({ ...specimen, seed: index }));
  applyAction(state, { type: 'display', slot: 'left' });
  assert.equal(state.slots.left.plant, plant);
  const coins = state.coins;
  applyAction(state, { type: 'sell', index: 0, expectedSeed: 1 });
  assert.equal(state.shelf.length, SHELF_LIMIT);
  applyAction(state, { type: 'sell', index: 0, expectedSeed: 0 });
  assert.equal(state.coins, coins + salePrice(specimen) + ACHIEVEMENTS.sold.reward);
  applyAction(state, { type: 'display', slot: 'left' });
  assert.equal(state.shelf.at(-1).seed, plant.seed);
  assert.equal(state.slots.left.plant, null);
  applyAction(state, { type: 'sell', slot: 'left' });
  assert.equal(state.stats.sold, 1);
});

test('零余额空窗台可种下练习包，重复请求不会再发放', () => {
  const state = fresh();
  state.coins = 0;
  state.slots.left.plant = null;
  const request = { type: 'plant', species: 'chamomile', pot: 'clay', kit: true, slot: 'left', seed: 5 };
  applyAction(state, request);
  applyAction(state, { ...request, slot: 'middle' });
  assert.ok(state.slots.left.plant);
  assert.equal(state.slots.middle.plant, null);
  assert.equal(state.coins, 0);
});

test('合法存档可往返，坏存档和未知版本会被拒绝', () => {
  const state = fresh();
  assert.deepEqual(decodeSave(JSON.stringify(state)), state);
  assert.throws(() => decodeSave(JSON.stringify({ ...state, version: 999 })));
  assert.throws(() => decodeSave(JSON.stringify({ ...state, coins: -1 })));
  state.slots.left.plant.pot = '__proto__';
  assert.throws(() => decodeSave(JSON.stringify(state)));
});

test('花架名片只含成熟展品并拒绝畸形快照', () => {
  const state = fresh();
  advance(state, 400);
  applyAction(state, { type: 'display', slot: 'left' });
  const url = new URL(shareURL(state, 'http://127.0.0.1:5173/'));
  const shared = readShare(url.hash);
  assert.deepEqual(shared.plants, state.shelf);
  assert.equal(shared.id, id);
  assert.equal(Object.hasOwn(shared, 'coins'), false);
  assert.throws(() => readShare('#garden=broken'));
  assert.throws(() => readShare(`#garden=${btoa(JSON.stringify({ v: 1, id, plants: [{ ...state.shelf[0], quality: 999 }] })).replace(/=+$/, '')}`));
});
