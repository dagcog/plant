import { ACHIEVEMENTS, EXPOSURES, PHASES, POTS, SHELF_LIMIT, SLOTS, SPECIES } from '@game/content.js';
import { needsStarterKit, phaseAt, stageOf, sunlight } from '@game/simulation.js';
import { valueForSpecimen as salePrice } from '@game/releases.js';
import { icon } from './icons.js';
import { plantArt } from './illustrations.js';

const nav = [['garden', 'window', '我的窗台'], ['shelf', 'shelf', '我的花架'], ['neighbors', 'people', '邻里花园'], ['album', 'book', '植物图鉴']];
const headings = {
  garden: ['THE WINDOWSILL', '我的窗台', '光落下来，叶子慢慢长大。'],
  shelf: ['THE COLLECTION', '我的花架', '把舍不得卖的那一盆，留在看得见的地方。'],
  neighbors: ['THE NEIGHBORHOOD', '邻里花园', '沿着窗边走走，看看别人留下的花。'],
  album: ['THE FIELD NOTES', '植物图鉴', '每种开过的花，都在这里有一页。'],
  visit: ['GARDEN VISIT', '花架拜访', '近一点，看看每株植物的颜色和形状。'],
};
const art = (species = 'chamomile', pot = 'clay', mode) => plantArt({ species, pot, rare: false }, mode);
const coin = (amount) => `<span class="coin-inline">${icon('leaf', 14)} ${amount}</span>`;
const tag = (content, type = '') => `<span class="tag ${type}">${content}</span>`;
const escapeText = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const button = (action, label, symbol, options = {}) => `<button type="button" class="button ${options.class ?? 'secondary'}" data-action="${action}"${options.attrs ? ` ${options.attrs}` : ''}${options.disabled ? ' disabled' : ''}>${symbol ? icon(symbol, 17) : ''}${label}</button>`;
const iconButton = (action, label, symbol, attrs = '') => `<button type="button" class="icon-button" data-action="${action}" aria-label="${label}" title="${label}" ${attrs}>${icon(symbol, 17)}</button>`;

export function navigation(view) {
  return nav.map(([id, symbol, label]) => `<button type="button" class="nav-button" data-action="view" data-view="${id}"${(view === 'visit' ? 'neighbors' : view) === id ? ' aria-current="page"' : ''}>${icon(symbol, 17)}<span>${label}</span></button>`).join('');
}

export function intro(view, state) {
  const [eyebrow, title, text] = headings[view];
  const phase = phaseAt(state.time);
  return `<div><div class="eyebrow"><i></i>${eyebrow}</div><h1 id="page-title">${title}</h1><p>${text}</p></div>${view === 'garden' ? `<div class="time-card"><span class="time-icon">${icon(phase.icon, 21)}</span><span><strong>${phase.label}</strong><small>窗台时间 ${phase.time}</small></span></div>` : ''}${view === 'shelf' ? button('share', state.sharing.token ? '管理分享' : '分享花架', 'link', { class: 'primary', disabled: !state.shelf.length && !state.sharing.token }) : ''}${view === 'visit' ? button('view', '返回邻里', 'left', { attrs: 'data-view="neighbors"' }) : ''}`;
}

export function phaseControls(phase, fastForward) {
  return fastForward ? PHASES.map((entry) => `<button type="button" data-action="phase" data-id="${entry.id}" aria-pressed="${phase.id === entry.id}" title="等到${entry.label}">${icon(entry.icon, 17)}<span>${entry.label}</span></button>`).join('') : '';
}

export function markers(state, selected) {
  return SLOTS.map(({ id, number, name, x }) => {
    const { unlocked, plant } = state.slots[id];
    const symbol = plant ? (plant.quality === null ? 'leaf' : 'sparkle') : unlocked ? 'plus' : 'lock';
    return `<button type="button" class="slot-marker${id === selected ? ' selected' : ''}${plant ? ' occupied' : ''}" style="--x:${50 + x * 25}%;--y:85%" data-slot="${id}" data-action="select" aria-pressed="${id === selected}" aria-label="${number} ${name}，${plant ? SPECIES[plant.species].name : unlocked ? '空盆位' : '待解锁'}">${icon(symbol, 15)}<span>${name}</span></button>`;
  }).join('');
}

export function toolbar(state, selected) {
  const active = Object.values(state.slots).filter(({ plant }) => plant).length;
  const open = Object.values(state.slots).filter(({ unlocked }) => unlocked).length;
  return `<div class="toolbar-note">${icon('leaf', 17)}<span><strong>${active} 株在窗边</strong><small>${open} / ${SLOTS.length} 个种植位已解锁</small></span></div><div class="toolbar-actions">${state.fastForward ? button('wait', '等 30 秒', 'clock', { class: 'quiet', attrs: 'title="加速试玩，不影响真实时钟"' }) : ''}${button('shop', '种植商店', 'store', { class: 'primary', attrs: `data-slot="${selected}"` })}</div>`;
}

function metric(label, symbol, value, ideal, color, index) {
  return `<div class="metric" style="--meter:${color};--ideal:${ideal}%"><div>${icon(symbol, 15)}<span>${label}</span><small>偏好 ${ideal}%</small><strong data-metric="${index}">${value}%</strong></div><div class="meter"><i data-meter="${index}" style="width:${value}%"></i></div></div>`;
}

export function panel(state, selected) {
  const slot = SLOTS.find(({ id }) => id === selected);
  const { plant, unlocked } = state.slots[selected];
  const heading = `<div class="panel-kicker"><span>种植手记</span><span>NO. ${slot.number}</span></div>`;
  if (!plant) {
    return `${heading}<div class="empty-panel"><span class="empty-icon">${icon(unlocked ? 'seed' : 'lock', 29)}</span><h2>${slot.name}</h2><p>${unlocked ? '这儿空着。挑一粒种子和一个喜欢的花盆吧。' : '这里的光柔和一些，很适合喜欢散射光的植物。'}</p></div><div class="panel-bottom">${unlocked ? button('shop', '挑选种子与花盆', 'store', { class: 'primary wide', attrs: `data-slot="${selected}"` }) : button('unlock', `解锁 ${coin(slot.price)}`, 'lock', { class: 'primary wide', attrs: `data-slot="${selected}"`, disabled: state.coins < slot.price })}</div>`;
  }
  const species = SPECIES[plant.species];
  const stage = stageOf(plant);
  const mature = plant.quality !== null;
  const preview = `<button type="button" class="mini-plant" data-action="inspect-slot" data-slot="${selected}" aria-label="查看${species.name}的盆栽细节">${plantArt(plant)}${icon('view', 13)}</button>`;
  const values = [plant.moisture, plant.nutrition, sunlight(state.time, selected, plant.exposure)].map(Math.round);
  return `${heading}<div class="plant-heading">${preview}<div><div class="latin">${species.latin}</div><h2>${species.name}</h2><p>${POTS[plant.pot].name} <i></i> ${slot.name}</p></div></div>
    <div class="growth"><div><span>${tag(stage, mature ? 'ripe' : '')}${plant.rare ? tag(`${icon('sparkle', 12)} 异色`, 'rare') : ''}</span><strong data-growth>${mature ? `品质 ${plant.quality}` : `${Math.floor(plant.growth * 100)}%`}</strong></div><div class="meter"><i data-growth-bar style="width:${plant.growth * 100}%"></i></div></div>
    ${mature ? `<div class="ripe-note">${icon(plant.rare ? 'sparkle' : 'check')}<p>${plant.rare ? `发现异色「${species.rareName}」` : '花开好了，已经记入图鉴。'}</p></div><div class="panel-bottom two-actions">${button('display', '摆上花架', 'shelf', { class: 'primary', attrs: `data-slot="${selected}" data-plant="${plant.id}"`, disabled: state.shelf.length >= SHELF_LIMIT })}${button('sell-slot', `售卖 ${coin(salePrice(plant))}`, '', { attrs: `data-slot="${selected}" data-plant="${plant.id}"` })}</div>` : `
    <div class="plant-metrics">${metric('土壤湿度', 'droplet', values[0], species.ideal[0], '#7895a0', 0)}${metric('土壤养分', 'feed', values[1], species.ideal[1], '#8d9b68', 1)}${metric('当前光照', 'sun', values[2], species.ideal[2], '#cf9e56', 2)}</div>
    <div class="exposures" aria-label="调节光照">${EXPOSURES.map(({ name }, index) => `<button type="button" data-action="exposure" data-slot="${selected}" data-value="${index}" data-plant="${plant.id}" aria-pressed="${plant.exposure === index}">${name}</button>`).join('')}</div>
    <div class="panel-bottom two-actions">${button('water', '浇水', 'droplet', { attrs: `data-slot="${selected}" data-plant="${plant.id}"` })}${button('feed', '施肥', 'feed', { attrs: `data-slot="${selected}" data-plant="${plant.id}"` })}</div>`}
    <button type="button" class="text-button inspect-link" data-action="inspect-slot" data-slot="${selected}">${icon('view', 15)} 细看盆栽 ${icon('arrow', 14)}</button>`;
}

function specimenCard(plant, index, own, last = false) {
  const species = SPECIES[plant.species];
  return `<article class="specimen-card"><button class="specimen-art ${plant.species}" type="button" data-action="inspect-specimen" data-index="${index}" aria-label="细看${species.name}">${plantArt(plant)}${plant.rare ? tag(`✦ ${species.rareName}`, 'rare') : ''}</button><div class="specimen-info"><div><div class="latin">${species.latin}</div><h3>${species.name}</h3><p>品质 ${plant.quality} · ${POTS[plant.pot].name}</p></div>${own ? `<div class="specimen-actions">${iconButton('move', '向前移动', 'left', `data-index="${index}" data-offset="-1" data-plant="${plant.id}"${index ? '' : ' disabled'}`)}${iconButton('move', '向后移动', 'right', `data-index="${index}" data-offset="1" data-plant="${plant.id}"${last ? ' disabled' : ''}`)}</div>` : ''}</div>${own ? `<div class="specimen-footer">${button('sell-shelf', `售卖 ${coin(salePrice(plant))}`, '', { class: 'quiet', attrs: `data-index="${index}" data-plant="${plant.id}"` })}</div>` : ''}</article>`;
}

export function collection(view, state, visit, neighbors) {
  if (view === 'shelf') {
    return `<div class="section-label"><span>展品 · ${state.shelf.length} / ${SHELF_LIMIT}</span><span>点击盆栽查看细节</span></div>${state.shelf.length ? `<div class="specimen-grid">${state.shelf.map((plant, i) => specimenCard(plant, i, true, i === state.shelf.length - 1)).join('')}</div>` : `<div class="empty-collection">${art()}<h2>花架还空着</h2><p>窗台的植物成熟后，可以把它留下来。</p>${button('view', '回到窗台', 'window', { class: 'primary', attrs: 'data-view="garden"' })}</div>`}`;
  }
  if (view === 'visit' && visit) {
    return `<div class="visit-banner"><div><div class="latin">${escapeText(visit.author)}</div><h2>${escapeText(visit.name)}</h2></div>${visit.own ? tag('自己的名片') : visit.token ? button('like', `喜欢 · ${visit.likes}`, 'heart', { attrs: `aria-pressed="${visit.liked}"` }) : tag('试玩快照')}</div>${visit.plants.length ? `<div class="specimen-grid">${visit.plants.map((plant, i) => specimenCard(plant, i, false)).join('')}</div>` : '<div class="empty-collection"><h2>这张名片上的花架是空的</h2></div>'}`;
  }
  if (view === 'neighbors') {
    return `<div class="section-label"><span>邻里公开花架</span><span>喜欢会保存在花园服务</span></div>${neighbors === null ? '<p>正在读取邻里花架…</p>' : `<div class="neighbor-grid">${neighbors.map((entry, i) => `<article class="neighbor-card"><div class="neighbor-art ${i % 2 ? 'peach' : 'fern'}">${entry.plants.slice(0, 2).map((plant) => plantArt(plant)).join('')}</div><div class="neighbor-info"><div class="latin">${escapeText(entry.author)}</div><h2>${escapeText(entry.name)}</h2><p>${entry.plants.length} 盆展品 · ${entry.likes} 个喜欢</p>${button('visit', '去看看', 'arrow', { attrs: `data-id="${escapeText(entry.token)}"` })}</div></article>`).join('')}</div>`}<div class="share-help">${icon('link')} <span>收到朋友的花架链接后，在浏览器打开它就能参观。</span></div>`;
  }
  return `<div class="section-label"><span>已记录 · ${Object.keys(state.album).length} / ${Object.keys(SPECIES).length}</span><span>成熟时自动记录</span></div><div class="specimen-grid">${Object.entries(SPECIES).map(([id, style]) => { const entry = state.album[id]; return `<article class="specimen-card${entry ? '' : ' undiscovered'}"><div class="specimen-art ${id}">${art(id)}${tag(entry ? `记录 ${entry.count}` : '待记录')}</div><div class="specimen-info"><div class="latin">${style.latin}</div><h3>${style.name}</h3><p>${style.detail}</p><p>${entry ? `最佳品质 ${entry.best} · 异色 ${entry.rare} 株` : '在窗台培育一株至成熟，即可点亮。'}</p></div></article>`; }).join('')}</div><h2 class="medal-title">窗边里程碑</h2><div class="medals">${Object.entries(ACHIEVEMENTS).map(([id, achievement]) => `<article class="medal${Object.hasOwn(state.achievements, id) ? ' earned' : ''}"><span class="medal-icon">${icon(Object.hasOwn(state.achievements, id) ? 'sparkle' : 'lock', 19)}</span><div><h3>${achievement.name}</h3><p>${achievement.detail} · ${achievement.reward} 叶币</p></div></article>`).join('')}</div>`;
}

export function dialogHeader(kicker, title, description) {
  return `<div class="dialog-header"><div><div class="eyebrow"><i></i>${kicker}</div><h2 id="dialog-title">${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${iconButton('close', '关闭', 'close')}</div>`;
}

export function shop(state, draft) {
  const available = SLOTS.filter(({ id }) => state.slots[id].unlocked && !state.slots[id].plant);
  const cost = SPECIES[draft.species].price + POTS[draft.pot].price;
  const option = (id, entry, field, mode) => `<button type="button" class="shop-option" data-action="choose" data-field="${field}" data-value="${id}" aria-pressed="${draft[field] === id}"><span class="shop-art ${id}">${mode === 'seed' ? art(id, 'clay', mode) : art('chamomile', id, mode)}</span><span><strong>${entry.name}</strong><small>${entry.detail}</small></span>${coin(entry.price)}</button>`;
  return `${dialogHeader('THE GARDEN SHOP', '种植商店', '选一粒种子、一只花盆，给窗台添一点绿。')}<div class="shop-body"><div class="shop-choices"><h3>01 <span>选种子</span></h3>${Object.entries(SPECIES).map(([id, entry]) => option(id, entry, 'species', 'seed')).join('')}</div><div class="shop-choices"><h3>02 <span>选花盆</span></h3>${Object.entries(POTS).map(([id, entry]) => option(id, entry, 'pot', 'pot')).join('')}</div></div><div class="shop-footer"><div><label for="shop-slot">种植到</label><select id="shop-slot" ${available.length ? '' : 'disabled'}>${available.length ? available.map(({ id, name }) => `<option value="${id}"${draft.slot === id ? ' selected' : ''}>${name}</option>`).join('') : '<option>暂无空种植位</option>'}</select></div><div class="shop-total">${needsStarterKit(state) && available.length ? button('kit', '领取练习种植包', 'seed', { class: 'quiet' }) : ''}${button('plant', `购买并种下 ${coin(cost)}`, 'plus', { class: 'primary', disabled: !available.length || !available.some(({ id }) => id === draft.slot) || state.coins < cost })}</div></div>`;
}

export function inspection(specimen) {
  const species = SPECIES[specimen.species];
  return `${dialogHeader('A CLOSER LOOK', species.name, specimen.rare ? `异色 · ${species.rareName}` : `${species.latin} · ${POTS[specimen.pot].name}`)}<div class="inspection-stage" id="inspection-stage">${plantArt(specimen)}</div><div class="inspection-footer"><span>拖动旋转 · 滚轮或双指缩放</span><div class="camera-tools">${iconButton('turn-left', '向左旋转', 'left')}${iconButton('turn-right', '向右旋转', 'right')}${iconButton('zoom-out', '缩小', 'minus')}${iconButton('zoom-in', '放大', 'plus')}${iconButton('reset-camera', '重置视角', 'rotate')}</div></div>`;
}
