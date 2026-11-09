import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { releaseFor, valueForSpecimen } from '../shared/releases.js';
import { ApiError, uuidPattern } from './errors.js';
import { loadGarden, saveTransition, upgradeGardenToV2 } from './garden-repository.js';

const idValid = (id) => typeof id === 'string' && uuidPattern.test(id);

function validatedAction(action, fastForward, { PHASES, POTS, SLOTS, SPECIES }) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new ApiError(400, '缺少游戏操作。');
  const { type, slot, expectedId, species, pot, value, offset, id, visibility } = action;
  const slotValid = (id) => SLOTS.some((slot) => slot.id === id);
  const target = slotValid(slot) && idValid(expectedId);
  switch (type) {
    case 'plant':
      if (slotValid(slot) && typeof species === 'string' && Object.hasOwn(SPECIES, species)
        && typeof pot === 'string' && Object.hasOwn(POTS, pot)) return { type, slot, species, pot, kit: action.kit === true };
      break;
    case 'unlock': if (slotValid(slot)) return { type, slot }; break;
    case 'water': case 'feed': case 'display':
      if (target) return { type, slot, expectedId };
      break;
    case 'exposure': if (target && [0, 1, 2].includes(value)) return { type, slot, expectedId, value }; break;
    case 'sell':
      if (idValid(expectedId) && (slot === undefined || slotValid(slot))) return slot ? { type, expectedId, slot } : { type, expectedId };
      break;
    case 'move': if (idValid(expectedId) && [-1, 1].includes(offset)) return { type, expectedId, offset }; break;
    case 'wait': if (fastForward) return { type }; break;
    case 'phase': if (fastForward && PHASES.some((phase) => phase.id === id)) return { type, id }; break;
    case 'publish': if (['public', 'unlisted'].includes(visibility)) return { type, visibility }; break;
    case 'unpublish': return { type };
  }
  throw new ApiError(400, '操作参数无效或当前模式不可用。');
}

async function saveRequest(tx, player, request, action) {
  await tx.query('INSERT INTO windowsill.action_requests (player_id,request_id,action_key,arguments) VALUES ($1,$2,$3,$4)',
    [player, request, action.type, JSON.stringify(action)]);
}

function perform(state, action, release) {
  const { applyAction } = release.rules;
  if (action.type === 'publish') {
    if (!state.shelf.length) return { message: '花架上有展品后才能发布。' };
    state.sharing = { visibility: action.visibility, token: state.sharing.token ?? randomUUID() };
    return { message: action.visibility === 'public' ? '已发布到邻里花园。' : '花架名片已生成。' };
  }
  if (action.type === 'unpublish') {
    state.sharing = { visibility: 'private', token: null };
    return { message: '已撤回花架，旧链接已失效。' };
  }
  let index;
  if (action.expectedId) {
    const specimen = action.slot ? state.slots[action.slot].plant : state.shelf[index = state.shelf.findIndex(({ id }) => id === action.expectedId)];
    if (specimen?.id !== action.expectedId) return { message: '盆栽已变更，请重新选择。' };
  }
  if (action.type !== 'plant') return { message: applyAction(state, { ...action, index }, valueForSpecimen) };
  const before = state.slots[action.slot].plant;
  const message = applyAction(state, { ...action, seed: randomBytes(4).readUInt32LE() });
  const plant = state.slots[action.slot].plant;
  if (plant && !before) {
    plant.id = randomUUID();
    plant.contentVersion = release.version;
    return { message, plantedId: plant.id };
  }
  return { message };
}

export function createGameService(database, { fastForward = process.env.NODE_ENV !== 'production', clock = Date.now } = {}) {
  async function game(player, payload, verifySession) {
    const request = payload?.requestId;
    if (payload && !idValid(request)) throw new ApiError(400, '缺少有效的请求编号。');
    return database.transaction(async (tx) => {
      await tx.query('SELECT id FROM windowsill.players WHERE id=$1 FOR UPDATE', [player]);
      if (verifySession && !await verifySession(tx)) throw new ApiError(401, '会话已变更，请重新连接。');
      const { state, release } = await loadGarden(tx, player);
      const target = release.version === 1 ? releaseFor(2) : release;
      const action = payload ? validatedAction(payload.action, fastForward, target.content) : null;
      state.fastForward = fastForward;
      if (action) {
        const { rows: [receipt] } = await tx.query('SELECT arguments,result FROM windowsill.action_requests WHERE player_id=$1 AND request_id=$2', [player, request]);
        if (receipt) {
          if (!isDeepStrictEqual(receipt.arguments, action)) throw new ApiError(409, '这个请求编号已被另一项操作使用。');
          return { state, ...receipt.result };
        }
      }

      const now = Math.max(clock(), state.wall);
      let before = structuredClone(state);
      if (release.rules.catchUp(state, now)) {
        let settlement;
        if (state.coins !== before.coins) {
          settlement = randomUUID();
          await saveRequest(tx, player, settlement, { type: 'settle' });
        }
        await saveTransition(tx, { player, release, before, state, now, request: settlement });
      }
      if (target !== release) await upgradeGardenToV2(tx, state);
      if (!action) return { state, message: '' };

      before = structuredClone(state);
      const result = perform(state, action, target);
      await saveRequest(tx, player, request, action);
      if (!isDeepStrictEqual(before, state)) await saveTransition(tx, { player, release: target, before, state, now, request, action });
      await tx.query('UPDATE windowsill.action_requests SET result=$3 WHERE player_id=$1 AND request_id=$2', [player, request, JSON.stringify(result)]);
      return { state, ...result };
    });
  }

  return { game };
}
