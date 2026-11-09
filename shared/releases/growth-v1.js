const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const defaultStages = ['发芽', '展叶', '孕蕾', '成熟'];

export function seeded(seed, salt = 0) {
  let number = (seed + salt + 0x9e3779b9) | 0;
  number = Math.imul(number ^ (number >>> 16), 0x21f0aaad);
  number = Math.imul(number ^ (number >>> 15), 0x735a2d97);
  return ((number ^ (number >>> 15)) >>> 0) / 4294967296;
}

export function stageIndex(plant) {
  if (plant.quality !== null) return 3;
  if (plant.growth >= 0.66) return 2;
  if (plant.growth >= 0.22) return 1;
  return 0;
}

export function createRules(content, {
  collections = { collection: Object.keys(content.SPECIES) },
  contentForPlant = () => content,
} = {}) {
  const { ACHIEVEMENTS, CYCLE, EXPOSURES, OFFLINE_CAP, PHASES, POTS, SHELF_LIMIT, SLOTS, SPECIES } = content;
  const bySlot = (id) => SLOTS.find((slot) => slot.id === id);

  function phaseAt(time) {
    let within = time % CYCLE;
    return PHASES.find((phase) => {
      if (within < phase.seconds) return true;
      within -= phase.seconds;
      return false;
    });
  }

  function sunlight(time, slotId, exposure = 1) {
    return Math.round(clamp((phaseAt(time).light + bySlot(slotId).offset) * EXPOSURES[exposure].factor));
  }

  function plantFrom(species, pot, seed) {
    return { species, pot, seed, moisture: 58, nutrition: 63, exposure: 1, growth: 0, score: 0, samples: 0, quality: null, rare: false };
  }

  function createGame(now = Date.now(), gardenId = Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) => byte.toString(16).padStart(2, '0')).join('')) {
    const starter = plantFrom('chamomile', 'clay', 258337233);
    Object.assign(starter, { growth: 0.38, score: 33.6, samples: 40 });
    return {
      version: 1, gardenId, revision: 0, time: 18, wall: now, coins: 86,
      slots: Object.fromEntries(SLOTS.map(({ id, price }) => [id, { unlocked: price === 0, plant: id === 'left' ? starter : null }])),
      shelf: [], album: {}, achievements: {}, likes: {}, stats: { sold: 0, displayed: 0 },
    };
  }

  function stageOf(plant) {
    return (SPECIES[plant.species]?.stages ?? defaultStages)[stageIndex(plant)];
  }

  function award(state, id) {
    if (Object.hasOwn(state.achievements, id)) return;
    state.achievements[id] = state.time;
    state.coins += ACHIEVEMENTS[id].reward;
  }

  function specimenOf(plant) {
    const { species, pot, seed, rare, quality } = plant;
    return { species, pot, seed, rare, quality };
  }

  function mature(state, plant) {
    plant.growth = 1;
    plant.quality = Math.round(100 * plant.score / plant.samples);
    plant.rare = seeded(plant.seed, 31415) < 0.05 + 0.16 * plant.quality / 100;
    const entry = state.album[plant.species] ?? { count: 0, rare: 0, best: 0 };
    state.album[plant.species] = { count: entry.count + 1, rare: entry.rare + Number(plant.rare), best: Math.max(entry.best, plant.quality) };
    award(state, 'bloom');
    if (plant.rare) award(state, 'rare');
    for (const [achievement, species] of Object.entries(collections)) {
      if (species.every((id) => state.album[id])) award(state, achievement);
    }
  }

  function advance(state, seconds) {
    const total = clamp(Math.floor(seconds), 0, OFFLINE_CAP);
    for (let elapsed = 0; elapsed < total; elapsed++) {
      state.time++;
      for (const { id } of SLOTS) {
        const plant = state.slots[id].plant;
        if (!plant || plant.quality !== null) continue;
        const catalog = contentForPlant(plant);
        const species = catalog.SPECIES[plant.species];
        const light = sunlight(state.time, id, plant.exposure);
        const values = [plant.moisture, plant.nutrition, light];
        const fit = values.reduce((sum, value, i) => sum + 1 - Math.abs(value - species.ideal[i]) / 100, 0) / 3;
        plant.moisture = clamp(plant.moisture - catalog.POTS[plant.pot].drainage * (0.10 + light * 0.0017));
        plant.nutrition = clamp(plant.nutrition - 0.13);
        plant.score += fit;
        plant.samples++;
        plant.growth += (0.58 + 0.54 * fit) / species.seconds;
        if (plant.growth >= 1) mature(state, plant);
      }
    }
    return state;
  }

  function catchUp(state, now = Date.now()) {
    const elapsed = Math.floor((now - state.wall) / 1000);
    if (elapsed <= 0) return false;
    advance(state, elapsed);
    state.wall += elapsed * 1000;
    return true;
  }

  function salePrice(plant) {
    return Math.round(SPECIES[plant.species].value * (0.7 + 0.45 * plant.quality / 100) * (plant.rare ? 1.6 : 1));
  }

  function needsStarterKit(state) {
    const cheapest = Math.min(...Object.values(SPECIES).map(({ price }) => price)) + Math.min(...Object.values(POTS).map(({ price }) => price));
    return state.coins < cheapest && Object.values(state.slots).every(({ plant }) => !plant);
  }

  function applyAction(state, action, valuePlant = salePrice) {
    const slot = Object.hasOwn(state.slots, action.slot) ? state.slots[action.slot] : null;
    const plant = slot?.plant;
    if (action.expectedSeed !== undefined && (Number.isInteger(action.index) ? state.shelf[action.index] : plant)?.seed !== action.expectedSeed) return '';
    switch (action.type) {
      case 'unlock': {
        if (!slot || slot.unlocked) return '';
        const config = bySlot(action.slot);
        if (state.coins < config.price) return '叶币还不够。';
        state.coins -= config.price;
        slot.unlocked = true;
        if (SLOTS.every(({ id }) => state.slots[id].unlocked)) award(state, 'full');
        return `${config.name}已解锁。`;
      }
      case 'plant': {
        if (!slot?.unlocked || plant || !Object.hasOwn(SPECIES, action.species) || !Object.hasOwn(POTS, action.pot)) return '';
        const { species, pot } = action;
        const isKit = action.kit && species === 'chamomile' && pot === 'clay' && needsStarterKit(state);
        const cost = isKit ? 0 : SPECIES[species].price + POTS[pot].price;
        if (state.coins < cost) return '叶币还不够。';
        state.coins -= cost;
        slot.plant = plantFrom(species, pot, action.seed >>> 0);
        return `${SPECIES[species].name}已种下。`;
      }
      case 'water':
        if (!plant || plant.quality !== null) return '';
        plant.moisture = clamp(plant.moisture + 26);
        return plant.moisture > 83 ? '土壤已经很湿，等它慢慢透气。' : '土壤湿润了一些。';
      case 'feed':
        if (!plant || plant.quality !== null) return '';
        plant.nutrition = clamp(plant.nutrition + 22);
        return plant.nutrition > 86 ? '养分已经很充足。' : '给土壤添了一点养分。';
      case 'exposure':
        if (!plant || plant.quality !== null || !Object.hasOwn(EXPOSURES, action.value)) return '';
        plant.exposure = action.value;
        return `光照已调为${EXPOSURES[action.value].name}。`;
      case 'wait':
        advance(state, 30);
        return '让时间慢慢走了 30 秒。';
      case 'phase': {
        const index = PHASES.findIndex(({ id }) => id === action.id);
        if (index < 0 || phaseAt(state.time).id === action.id) return '';
        const target = PHASES.slice(0, index).reduce((sum, phase) => sum + phase.seconds, 0);
        advance(state, (target - state.time % CYCLE + CYCLE) % CYCLE);
        return PHASES[index].note;
      }
      case 'display':
        if (!plant || plant.quality === null) return '';
        if (state.shelf.length >= SHELF_LIMIT) return '花架已满，可以先售出一盆展品。';
        state.shelf.push({ ...specimenOf(plant), ...(plant.id ? { id: plant.id, contentVersion: plant.contentVersion } : {}) });
        slot.plant = null;
        state.stats.displayed++;
        award(state, 'display');
        return '新展品已经摆上花架。';
      case 'sell': {
        const fromShelf = Number.isInteger(action.index) && action.index >= 0;
        const specimen = fromShelf ? state.shelf[action.index] : plant;
        if (!specimen || specimen.quality === null) return '';
        const amount = valuePlant(specimen);
        state.coins += amount;
        if (fromShelf) state.shelf.splice(action.index, 1);
        else slot.plant = null;
        state.stats.sold++;
        award(state, 'sold');
        return `已售出，获得 ${amount} 叶币。`;
      }
      case 'move': {
        const { index, offset } = action;
        const next = index + offset;
        if (!Number.isInteger(index) || ![-1, 1].includes(offset) || !state.shelf[index] || !state.shelf[next]) return '';
        [state.shelf[index], state.shelf[next]] = [state.shelf[next], state.shelf[index]];
        return '花架顺序已调整。';
      }
      case 'like':
        if (typeof action.id !== 'string' || !/^(demo-(fern|slow)|[a-f0-9-]{36})$/.test(action.id) || action.id === state.gardenId) return '';
        if (Object.hasOwn(state.likes, action.id)) {
          delete state.likes[action.id];
          return '已收回喜欢。';
        }
        state.likes[action.id] = true;
        return '送出了一片喜欢。';
      default:
        return '';
    }
  }

  return { advance, applyAction, catchUp, createGame, needsStarterKit, phaseAt, plantFrom, salePrice, specimenOf, stageOf, sunlight };
}
