import { randomUUID } from 'node:crypto';
import { currentRelease, releaseFor } from '../shared/releases.js';

const timestamp = (value) => new Date(value).toISOString();

export async function appendLeaves(tx, playerId, requestId, lines) {
  for (const [index, line] of lines.entries()) {
    await tx.query(`INSERT INTO windowsill.leaf_ledger
      (player_id, request_id, line_no, reason, delta, garden_id, plant_id, achievement_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [playerId, requestId, index + 1, line.reason, line.delta,
      line.garden ?? null, line.plant ?? null, line.achievement ?? null]);
  }
}

export async function initializeGuest(tx, subject, now) {
  const player = randomUUID();
  const garden = randomUUID();
  const { version, rules } = currentRelease;
  const initial = rules.createGame(now, garden);
  const request = randomUUID();
  await tx.query(`INSERT INTO windowsill.players (id, auth_issuer, auth_subject, display_name)
    VALUES ($1,'guest',$2,$3)`, [player, subject, `花友 ${player.slice(0, 4)}`]);
  await tx.query(`INSERT INTO windowsill.gardens (id, player_id, content_version, title, game_seconds, settled_at)
    VALUES ($1,$2,$3,$4,$5,$6)`, [garden, player, version, '窗边花架', initial.time, timestamp(now)]);
  await tx.query('INSERT INTO windowsill.wallets (player_id) VALUES ($1)', [player]);
  await tx.query(`INSERT INTO windowsill.garden_slots (garden_id, slot_key, catalog_version)
    SELECT $1, slot_key, content_version FROM windowsill.slot_catalog WHERE content_version = $2 AND unlock_price = 0`, [garden, version]);
  await tx.query("INSERT INTO windowsill.action_requests (player_id, request_id, action_key, arguments) VALUES ($1,$2,'initialize','{}')", [player, request]);
  await appendLeaves(tx, player, request, [{ reason: 'opening', delta: initial.coins }]);
  for (const [slot, plant] of slottedPlants(initial)) await insertPlant(tx, garden, version, slot, { ...plant, id: randomUUID() }, now);
  return player;
}

export async function loadGarden(tx, player) {
  const { rows: [garden] } = await tx.query(`SELECT g.*, w.balance,
      (SELECT count(*) FROM windowsill.plants WHERE garden_id = g.id AND sold_at IS NOT NULL) AS sold_count,
      (SELECT count(*) FROM windowsill.plants WHERE garden_id = g.id AND displayed_at IS NOT NULL) AS displayed_count
    FROM windowsill.gardens g JOIN windowsill.wallets w USING (player_id)
    WHERE g.player_id = $1 FOR UPDATE OF g`, [player]);
  if (!garden) throw new Error('Missing garden or wallet for player');
  const release = releaseFor(garden.content_version);
  const state = {
    version: 1, gardenId: garden.id, revision: Number(garden.revision), time: Number(garden.game_seconds),
    wall: new Date(garden.settled_at).getTime(), coins: Number(garden.balance),
    contentVersion: release.version,
    slots: Object.fromEntries(release.content.SLOTS.map(({ id }) => [id, { unlocked: false, plant: null }])),
    shelf: [], album: {}, achievements: {}, likes: {},
    stats: { sold: Number(garden.sold_count), displayed: Number(garden.displayed_count) },
    sharing: { visibility: garden.visibility, token: garden.share_token },
  };
  const { rows: slots } = await tx.query('SELECT slot_key FROM windowsill.garden_slots WHERE garden_id = $1', [garden.id]);
  for (const { slot_key } of slots) if (state.slots[slot_key]) state.slots[slot_key].unlocked = true;
  const { rows: plants } = await tx.query(`SELECT p.*, COALESCE(v.is_rare, false) AS rare
    FROM windowsill.plants p LEFT JOIN windowsill.species_variants v USING (content_version, species_key, variant_key)
    WHERE p.garden_id = $1 AND p.sold_at IS NULL ORDER BY p.shelf_position`, [garden.id]);
  for (const row of plants) {
    const specimen = { id: row.id, contentVersion: row.content_version, species: row.species_key, pot: row.pot_key,
      seed: Number(row.visual_seed), quality: row.quality, rare: row.rare };
    if (row.shelf_position !== null) state.shelf.push(specimen);
    else if (state.slots[row.slot_key]) state.slots[row.slot_key].plant = {
      ...specimen, moisture: row.moisture, nutrition: row.nutrition, exposure: row.exposure,
      growth: row.growth, samples: row.fit_samples, score: row.fit_sum,
    };
  }
  const { rows: album } = await tx.query('SELECT * FROM windowsill.plant_album WHERE garden_id = $1', [garden.id]);
  for (const row of album) state.album[row.species_key] = { count: Number(row.mature_count), rare: Number(row.rare_count), best: row.best_quality };
  const { rows: achievements } = await tx.query('SELECT achievement_key, earned_game_seconds FROM windowsill.earned_achievements WHERE player_id = $1', [player]);
  for (const row of achievements) state.achievements[row.achievement_key] = Number(row.earned_game_seconds);
  return { state, release };
}

export async function upgradeGardenToV2(tx, state) {
  await tx.query('UPDATE windowsill.garden_slots SET catalog_version=2 WHERE garden_id=$1', [state.gardenId]);
  await tx.query('UPDATE windowsill.gardens SET content_version=2, revision=revision+1 WHERE id=$1', [state.gardenId]);
  state.contentVersion = 2;
  state.revision++;
}

async function insertPlant(tx, garden, version, slot, plant, now) {
  await tx.query(`INSERT INTO windowsill.plants
      (id, garden_id, content_version, species_key, pot_key, visual_seed, slot_key, moisture, nutrition,
       exposure, growth, fit_samples, fit_sum, planted_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [plant.id, garden, version, plant.species, plant.pot,
    plant.seed, slot, plant.moisture, plant.nutrition, plant.exposure, plant.growth, plant.samples, plant.score, timestamp(now)]);
}

const slottedPlants = (state) => Object.entries(state.slots).filter(([, { plant }]) => plant).map(([slot, { plant }]) => [slot, plant]);

export async function saveTransition(tx, { player, release, before, state, now, request, action }) {
  const { version, content: { ACHIEVEMENTS } } = release;
  const garden = state.gardenId;
  const original = new Map(slottedPlants(before).map(([, plant]) => [plant.id, plant]));
  const currentSlots = slottedPlants(state);
  for (const [slot, value] of Object.entries(state.slots)) {
    if (value.unlocked && !before.slots[slot].unlocked) {
      await tx.query('INSERT INTO windowsill.garden_slots (garden_id, slot_key, catalog_version) VALUES ($1,$2,$3)', [garden, slot, version]);
    }
  }
  for (const [slot, plant] of currentSlots) {
    const old = original.get(plant.id);
    if (!old) await insertPlant(tx, garden, version, slot, plant, now);
    else if (JSON.stringify(old) !== JSON.stringify(plant)) {
      const style = releaseFor(plant.contentVersion).content.SPECIES[plant.species];
      await tx.query(`UPDATE windowsill.plants SET moisture=$2,nutrition=$3,exposure=$4,growth=$5,fit_samples=$6,
        fit_sum=$7,quality=$8,variant_key=$9,matured_at=COALESCE(matured_at,$10::timestamptz) WHERE id=$1`,
      [plant.id, plant.moisture, plant.nutrition, plant.exposure, plant.growth, plant.samples, plant.score,
        plant.quality, plant.quality === null ? null : plant.rare ? style.rareKey : 'normal', plant.quality === null ? null : timestamp(now)]);
    }
  }

  const shelfBefore = before.shelf.map(({ id }) => id);
  const shelfAfter = state.shelf.map(({ id }) => id);
  const active = new Set([...currentSlots.map(([, plant]) => plant.id), ...shelfAfter]);
  const sold = [...original.keys(), ...shelfBefore].find((id) => !active.has(id));
  if (sold) await tx.query('UPDATE windowsill.plants SET slot_key=NULL,shelf_position=NULL,sold_at=GREATEST(matured_at,$2::timestamptz) WHERE id=$1', [sold, timestamp(now)]);
  if (shelfAfter.join(',') !== shelfBefore.join(',')) {
    await tx.query('SET CONSTRAINTS windowsill.plants_shelf_position_unique DEFERRED');
    for (const [index, id] of shelfAfter.entries()) {
      if (shelfBefore[index] === id) continue;
      await tx.query(`UPDATE windowsill.plants SET slot_key=NULL,shelf_position=$2,
        displayed_at=COALESCE(displayed_at,GREATEST(matured_at,$3::timestamptz)) WHERE id=$1`, [id, index + 1, timestamp(now)]);
    }
    await tx.query('SET CONSTRAINTS windowsill.plants_shelf_position_unique IMMEDIATE');
  }

  const lines = [];
  let delta = state.coins - before.coins;
  for (const [key, gameSecond] of Object.entries(state.achievements)) {
    if (Object.hasOwn(before.achievements, key)) continue;
    await tx.query(`INSERT INTO windowsill.earned_achievements (player_id,achievement_key,content_version,earned_game_seconds)
      VALUES ($1,$2,$3,$4)`, [player, key, version, gameSecond]);
    const reward = ACHIEVEMENTS[key].reward;
    delta -= reward;
    if (reward) lines.push({ reason: 'achievement', delta: reward, achievement: key });
  }
  if (delta) lines.push({ reason: action.type === 'sell' ? 'sale' : action.type, delta, garden,
    plant: sold ?? (action.type === 'plant' ? state.slots[action.slot].plant.id : null) });
  if (lines.length) await appendLeaves(tx, player, request, lines);
  state.revision++;
  await tx.query(`UPDATE windowsill.gardens SET game_seconds=$2,settled_at=$3,revision=$4,visibility=$5,share_token=$6,
    published_at=CASE WHEN $5='private' THEN NULL ELSE COALESCE(published_at,$7::timestamptz) END WHERE id=$1`,
  [garden, state.time, timestamp(state.wall), state.revision, state.sharing.visibility, state.sharing.token, timestamp(now)]);
}
