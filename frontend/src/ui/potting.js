import { MATERIALS, POTS, SOIL_KEYS, SOIL_RECIPES, SPECIES } from '@game/content.js';
import { materialsUsed, normalizePotting, pottingEffects } from '@game/releases/v3/potting.js';

const art = (key) => `<img class="material-art" alt="" width="48" height="48" src="./assets/potting/${key}.png">`;
const stockOf = (state, key) => state.materialStock?.[key] ?? 0;
const unitLabel = (entry) => entry.kind === 'soil' ? '份' : '层';
const kinds = [['soil', '土壤'], ['topping', '盆面铺石'], ['drainage', '盆底滤水层']];

export function materialShop(state, draft, { button, dialogHeader, coin }) {
  const categories = kinds.map(([kind, title]) => {
    const products = Object.entries(MATERIALS).filter(([, entry]) => entry.kind === kind).map(([key, entry]) => `
      <div class="material-card">${art(key)}
        <div><strong>${entry.name}</strong><small>${entry.detail} 库存 ${stockOf(state, key)} ${unitLabel(entry)}</small></div>
        ${button('buy-material', `${entry.units} ${unitLabel(entry)} · ${coin(entry.price)}`, '', { attrs: `data-value="${key}" aria-label="购买${entry.name}"`, disabled: state.coins < entry.price })}
      </div>`).join('');
    return `<section><h3>${title}</h3>${products}</section>`;
  }).join('');
  return `${dialogHeader('THE GARDEN SHOP', '土壤与石材', '先买入库存，播种时按配方取用。')}
    <div class="material-content">${categories}</div>
    <div class="shop-footer"><span>余额 ${coin(state.coins)}</span>${button('shop-page', draft.materialReturn === 'potting' ? '返回配土' : '返回种植', 'left', { attrs: `data-value="${draft.materialReturn}"` })}</div>`;
}

export function pottingSetup(state, draft, { button, dialogHeader, coin }) {
  const { species, pot, mix, topping, drainage } = draft;
  const recipe = SOIL_RECIPES[species];
  const total = Object.values(mix ?? {}).reduce((sum, amount) => sum + amount, 0);
  const potting = normalizePotting({ mix: mix && Object.fromEntries(Object.entries(mix).filter(([, amount]) => amount > 0)), topping, drainage });
  const missing = Object.entries(materialsUsed(potting)).filter(([key, amount]) => stockOf(state, key) < amount);
  const effect = pottingEffects(species, potting);
  const cost = SPECIES[species].price + POTS[pot].price;
  const soilRows = SOIL_KEYS.map((key) => {
    const name = MATERIALS[key].name;
    const amount = mix?.[key] ?? 0;
    return `<div class="material-card mix-row">${art(key)}
      <div><strong>${name}</strong><small>推荐 ${recipe[key] ?? 0}% · 库存 ${stockOf(state, key)} 份</small></div>
      <div class="mix-adjust">
        ${button('mix-part', '−', '', { attrs: `data-value="${key}" data-delta="-5" aria-label="减少${name} 5%"`, disabled: amount === 0 })}
        <strong>${amount}%</strong>
        ${button('mix-part', '＋', '', { attrs: `data-value="${key}" data-delta="5" aria-label="增加${name} 5%"`, disabled: total >= 100 })}
      </div>
    </div>`;
  }).join('');
  const layers = kinds.slice(1).map(([kind, title]) => `<label>${title}
    <select id="potting-${kind}" data-layer="${kind}"><option value="">不使用</option>${Object.entries(MATERIALS).filter(([, entry]) => entry.kind === kind).map(([key, entry]) =>
    `<option value="${key}" ${draft[kind] === key ? 'selected' : ''}>${entry.name} · 库存 ${stockOf(state, key)} 层</option>`).join('')}</select>
  </label>`).join('');
  const note = potting === undefined ? '比例需要合计 100%。' : missing.length
    ? `库存还缺 ${missing.map(([key, amount]) => `${MATERIALS[key].name} ${amount - stockOf(state, key)} ${unitLabel(MATERIALS[key])}`).join('、')}。`
    : `生长速度 +${Math.round(effect.speed * 100)}% · 品质最高 +${Math.round(effect.quality * 100)} 点${drainage ? ' · 水分散失 +10%' : ''}`;
  const available = state.slots[draft.slot]?.unlocked && !state.slots[draft.slot].plant;
  return `${dialogHeader('POTTING BENCH', '播种前配土', `${SPECIES[species].name} · ${POTS[pot].name}。普通土免费，也可以从库存配土。`)}
    <div class="material-content">
      <div class="mix-tools">
        ${button('mix-reset', '使用普通土', '', { attrs: `aria-pressed="${mix === null}"` })}
        ${button('mix-recipe', '填入推荐比例', '')}
        <strong>${mix ? `合计 ${total}%` : '普通土已选'}</strong>
      </div>
      <div class="mix-list">${soilRows}</div>
      <div class="potting-layers">${layers}</div>
      <p class="potting-note" aria-live="polite">${note}</p>
    </div>
    <div class="shop-footer">
      <div class="shop-total">
        ${button('shop-page', '上一步', 'left', { attrs: 'data-value="plant"' })}
        ${button('shop-page', '购买材料', 'store', { attrs: 'data-value="materials"' })}
      </div>
      ${button('plant', `用${mix ? '自配土' : '普通土'}种下 ${coin(cost)}`, 'seed', { class: 'primary', disabled: !available || state.coins < cost || potting === undefined || missing.length > 0 })}
    </div>`;
}

export function pottingSummary(specimen) {
  if (!specimen.potting) return '';
  const { mix, topping, drainage } = specimen.potting;
  const parts = [mix ? SOIL_KEYS.filter((key) => mix[key]).map((key) => `${MATERIALS[key].name} ${mix[key]}%`).join(' · ') : '普通土'];
  if (topping) parts.push(`铺面 ${MATERIALS[topping].name}`);
  if (drainage) parts.push(`盆底 ${MATERIALS[drainage].name}`);
  return parts.join(' · ');
}
