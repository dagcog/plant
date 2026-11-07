import { POTS, SHELF_LIMIT, SLOTS, SPECIES } from '@game/content.js';
import { phaseAt, stageOf, sunlight } from '@game/simulation.js';
import { valueForSpecimen as salePrice } from '@game/releases.js';
import { readShare } from '@game/sharing.js';
import { createApiStore, neighbors, readShelf, setLike } from './api.js';
import { createWorld } from './render/world.js';
import { inspectPlant } from './render/inspection.js';
import { icon } from './ui/icons.js';
import { plantArt } from './ui/illustrations.js';
import { accountControl, accountDialog } from './ui/account.js';
import * as ui from './ui/views.js';

const $ = (id) => document.getElementById(id);
const dialog = $('dialog');
const scene = $('scene');
const worldHost = $('world');
const store = createApiStore();
const previousMarkup = new WeakMap();
const markerPositions = new Map();
let state;
let account = null;
let authBusy = false;
let syncing = false;
let view = 'garden';
let selected = SLOTS[0].id;
let visit = null;
let gardens = null;
let route = 0;
let draft = null;
let inspection = null;
let confirmation = null;
let modalType = null;
let toastTimer;
let panelKey;

function fill(element, html) {
  if (previousMarkup.get(element) === html) return false;
  const focused = element.contains(document.activeElement) ? document.activeElement : null;
  const focusKey = focused?.dataset.action ? JSON.stringify(focused.dataset) : null;
  element.innerHTML = html;
  previousMarkup.set(element, html);
  if (focusKey) [...element.querySelectorAll('[data-action]')].find((node) => JSON.stringify(node.dataset) === focusKey)?.focus({ preventScroll: true });
  return true;
}

function toast(text) {
  if (!text) return;
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
}

function positionMarkers() {
  for (const marker of $('slot-markers').children) {
    const position = markerPositions.get(marker.dataset.slot);
    if (!position) continue;
    marker.style.setProperty('--x', `${position[0]}%`);
    marker.style.setProperty('--y', `${position[1]}%`);
  }
}

const world = createWorld(worldHost, (id) => {
  if (!state || dialog.open || view !== 'garden') return;
  selected = id;
  render();
  const plant = state.slots[id].plant;
  if (plant) openInspection(plant);
}, (id, x, y) => {
  markerPositions.set(id, [x, y]);
  positionMarkers();
}, () => {
  worldHost.classList.add('fallback');
  if (state) drawFallback();
});

function drawFallback() {
  let art = worldHost.querySelector('.fallback-art');
  if (!art) {
    art = document.createElement('div');
    art.className = 'fallback-art';
    worldHost.append(art);
  }
  fill(art, `<div class="fallback-window"></div><div class="fallback-sill">${SLOTS.map(({ id }) => `<div>${state.slots[id].plant ? plantArt(state.slots[id].plant) : ''}</div>`).join('')}</div>`);
}

function renderPanel() {
  const { plant, unlocked } = state.slots[selected];
  const key = JSON.stringify([selected, unlocked, plant?.id, plant?.exposure, plant && stageOf(plant), plant?.quality,
    plant?.quality != null && state.shelf.length >= SHELF_LIMIT, !unlocked && state.coins >= SLOTS.find(({ id }) => id === selected).price]);
  const container = $('plant-panel');
  if (key !== panelKey) {
    panelKey = key;
    fill(container, ui.panel(state, selected));
  }
  if (!plant || plant.quality !== null) return;
  const values = [plant.moisture, plant.nutrition, sunlight(state.time, selected, plant.exposure)];
  container.querySelector('[data-growth]').textContent = `${Math.floor(plant.growth * 100)}%`;
  container.querySelector('[data-growth-bar]').style.width = `${plant.growth * 100}%`;
  for (const [index, value] of values.entries()) {
    container.querySelector(`[data-metric="${index}"]`).textContent = `${Math.round(value)}%`;
    container.querySelector(`[data-meter="${index}"]`).style.width = `${value}%`;
  }
}

function render() {
  fill($('navigation'), ui.navigation(view));
  fill($('intro'), ui.intro(view, state));
  fill($('account-control'), accountControl(account));
  fill($('currency'), `<span class="currency-icon">${icon('leaf', 16)}</span><strong>${state.coins}</strong><span class="currency-label">叶币</span>`);
  $('garden').hidden = view !== 'garden';
  $('collection').hidden = view === 'garden';
  if (view === 'garden') {
    const phase = phaseAt(state.time);
    scene.dataset.phase = phase.id;
    $('phase-controls').hidden = !state.fastForward;
    fill($('phase-controls'), ui.phaseControls(phase, state.fastForward));
    $('phase-caption').textContent = phase.note;
    if (fill($('slot-markers'), ui.markers(state, selected))) positionMarkers();
    fill($('garden-toolbar'), ui.toolbar(state, selected));
    renderPanel();
    world?.update(state, phase.id, selected);
    if (worldHost.classList.contains('fallback')) drawFallback();
  } else {
    fill($('collection'), ui.collection(view, state, visit, gardens));
  }
  if (modalType === 'shop') renderShop();
}

async function commit(action) {
  if (!action && syncing) return null;
  if (!action) syncing = true;
  try {
    const result = await store.run(action);
    showGardenResult(result);
    toast(result.message);
    return result;
  } catch (error) {
    if (error.status && error.status < 500 && error.status !== 401) toast(error.message);
    else {
      fill($('status'), `<span>暂时无法连接花园服务，进度会在重新连接后同步。</span>${ui.button('reconnect', '重试', 'rotate')}`);
      $('status').hidden = false;
    }
    return null;
  } finally { if (!action) syncing = false; }
}

function showGardenResult(result) {
  state = result.state;
  account = result.account;
  $('status').hidden = true;
  render();
}

function setView(next) {
  route++;
  view = next;
  if (next !== 'visit' && /^#(?:garden|shelf)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  render();
  if (next === 'neighbors') void refreshNeighbors();
}

async function refreshNeighbors() {
  try { gardens = await neighbors(); }
  catch (error) { gardens = []; toast(error.status ? error.message : '暂时无法读取邻里花架。'); }
  if (view === 'neighbors') render();
}

async function openVisit(token) {
  const pending = ++route;
  try {
    const result = await readShelf(token);
    if (pending !== route) return;
    visit = result;
    history.replaceState(null, '', `#shelf=${result.token}`);
    setView('visit');
  } catch (error) {
    if (pending !== route) return;
    setView('neighbors');
    toast(error.status ? error.message : '暂时无法访问这张花架名片。');
  }
}

async function parseLocation() {
  if (!state) return;
  if (location.hash.startsWith('#shelf=')) return openVisit(location.hash.slice(7));
  try {
    visit = readShare(location.hash);
    if (visit) setView('visit');
    else if (view === 'visit') setView('neighbors');
  } catch (error) {
    setView('neighbors');
    toast(error.message);
  }
}

function openDialog(type, html) {
  modalType = type;
  dialog.dataset.type = type;
  fill(dialog, html);
  if (!dialog.open) dialog.showModal();
}

function openAccount(mode = 'login') {
  const username = $('account-username')?.value;
  openDialog('account', accountDialog(account, mode));
  const field = $('account-username');
  if (field) {
    if (username) field.value = username;
    field.focus();
  }
}

function accountFeedback(message) {
  const feedback = $('account-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
}

async function authenticate(mode, fields, control) {
  if (authBusy) return;
  authBusy = true;
  control.disabled = true;
  $('account-feedback').hidden = true;
  try {
    const result = await store.authenticate(mode, fields);
    if (modalType === 'account') closeDialog();
    showGardenResult(result);
    if (view === 'visit') await parseLocation();
    toast(mode === 'logout' ? '已退出登录。' : mode === 'register' ? '注册成功，窗台已绑定到账号。' : '登录成功。');
  } catch (error) {
    const message = error.status && error.status < 500 ? error.message : '暂时无法连接花园服务，请重试。';
    if (modalType === 'account') accountFeedback(message);
    else toast(message);
  } finally {
    authBusy = false;
    control.disabled = false;
  }
}

function shopMarkup() {
  const available = SLOTS.filter(({ id }) => state.slots[id].unlocked && !state.slots[id].plant);
  if (!available.some(({ id }) => draft.slot === id)) draft.slot = available[0]?.id ?? null;
  return ui.shop(state, draft);
}

function renderShop() {
  fill(dialog, shopMarkup());
}

function openShop(id) {
  draft = { slot: id, species: Object.keys(SPECIES)[0], pot: Object.keys(POTS)[0] };
  openDialog('shop', shopMarkup());
  dialog.querySelector('.shop-option[aria-pressed="true"]')?.focus();
}

function openInspection(specimen) {
  if (!specimen) return;
  openDialog('inspection', ui.inspection(specimen));
  inspection = inspectPlant($('inspection-stage'), specimen);
  if (!inspection) {
    dialog.querySelector('.inspection-footer span').textContent = '当前设备显示盆栽插画。';
    for (const control of dialog.querySelectorAll('.camera-tools button')) control.disabled = true;
  }
}

function confirmSale(data) {
  const index = data.index === undefined ? undefined : Number(data.index);
  const specimen = index === undefined ? state.slots[data.slot]?.plant : state.shelf[index];
  if (specimen?.quality == null) return;
  confirmation = { type: 'sell', slot: data.slot, expectedId: specimen.id };
  openDialog('confirm', `${ui.dialogHeader('THE GARDEN SHOP', `售卖${SPECIES[specimen.species].name}？`, `售出后，这株植物会离开你的花园，你将获得 ${salePrice(specimen)} 叶币。`)}<div class="simple-footer">${ui.button('close', '先留着')}${ui.button('confirm-sale', '确认售卖', 'leaf', { class: 'primary' })}</div>`);
}

function closeDialog() {
  inspection?.close();
  inspection = null;
  modalType = null;
  confirmation = null;
  draft = null;
  dialog.close();
  previousMarkup.delete(dialog);
  dialog.replaceChildren();
}

function showShareDialog() {
  const { token, visibility } = state.sharing;
  if (!token) return;
  openDialog('share', `${ui.dialogHeader('A LITTLE POSTCARD', '分享我的花架', '朋友打开名片后能看到花架的最新布置。')}<div class="share-dialog"><label for="share-url">花架链接</label><input id="share-url" readonly><p>${visibility === 'public' ? '可通过链接访问，也会出现在邻里花园。' : '知道链接的人可以参观。'}</p><p id="copy-status" role="status"></p></div><div class="simple-footer">${ui.button('unpublish', '撤回分享', '', { class: 'quiet' })}${ui.button('share-visibility', visibility === 'public' ? '仅持链接可见' : '发布到邻里', '', { attrs: `data-value="${visibility === 'public' ? 'unlisted' : 'public'}"`, disabled: !state.shelf.length })}${ui.button('copy', '复制链接', 'link', { class: 'primary' })}</div>`);
  const link = new URL(location.href);
  link.hash = `shelf=${token}`;
  $('share-url').value = link.href;
}

dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeDialog();
});

dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
});

dialog.addEventListener('change', (event) => {
  if (event.target.id === 'shop-slot' && draft) draft.slot = event.target.value;
});

dialog.addEventListener('submit', (event) => {
  if (event.target.id !== 'account-form') return;
  event.preventDefault();
  const form = event.target;
  const mode = form.dataset.mode;
  const { username, password, confirm } = Object.fromEntries(new FormData(form));
  if (mode === 'register' && confirm !== password) {
    accountFeedback('两次输入的密码不一致。');
    $('account-confirm').focus();
    return;
  }
  void authenticate(mode, { username, password }, form.querySelector('button[type="submit"]'));
});

document.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled || (dialog.open && !dialog.contains(control))) return;
  const data = control.dataset;
  const action = data.action;
  if (control.tagName === 'A') event.preventDefault();
  if (action === 'reconnect') { const wasReady = Boolean(state); if (await commit() && !wasReady) await parseLocation(); return; }
  if (!state) return;
  const slot = data.slot;
  const index = data.index === undefined ? undefined : Number(data.index);
  const expectedId = data.plant;

  switch (action) {
    case 'account': if (!authBusy) openAccount(); break;
    case 'auth-mode': if (!authBusy) openAccount(data.mode); break;
    case 'logout': await authenticate('logout', {}, control); break;
    case 'view': setView(data.view); break;
    case 'select': selected = slot; render(); break;
    case 'shop': openShop(slot); break;
    case 'choose': draft[data.field] = data.value; renderShop(); break;
    case 'inspect-slot': openInspection(state.slots[slot]?.plant); break;
    case 'inspect-specimen': openInspection((view === 'visit' ? visit?.plants : state.shelf)?.[index]); break;
    case 'close': closeDialog(); break;
    case 'zoom-in': case 'zoom-out': case 'reset-camera': case 'turn-left': case 'turn-right': inspection?.command(action); break;
    case 'visit': await openVisit(data.id); break;
    case 'like': {
      const current = visit;
      try {
        const updated = await setLike(current.token, !current.liked);
        if (visit === current && view === 'visit') { visit = updated; render(); }
      } catch (error) { toast(error.status ? error.message : '暂时无法更新喜欢。'); }
      break;
    }
    case 'sell-slot': case 'sell-shelf': confirmSale(data); break;
    case 'confirm-sale': {
      const pending = confirmation;
      closeDialog();
      if (pending) await commit(pending);
      break;
    }
    case 'share': {
      if (!state.sharing.token) await commit({ type: 'publish', visibility: 'unlisted' });
      if (view === 'shelf') showShareDialog();
      break;
    }
    case 'share-visibility':
      if (await commit({ type: 'publish', visibility: data.value }) && modalType === 'share') showShareDialog();
      break;
    case 'unpublish':
      if (await commit({ type: 'unpublish' }) && modalType === 'share') closeDialog();
      break;
    case 'copy': {
      const field = $('share-url');
      let message;
      try { await navigator.clipboard.writeText(field.value); message = '花架链接已复制。'; }
      catch { field.focus(); field.select(); message = '链接已选中，可以手动复制。'; }
      if (dialog.contains(field)) $('copy-status').textContent = message;
      break;
    }
    case 'plant': case 'kit': {
      const requestDraft = draft;
      const { slot: destination, species, pot } = draft;
      const kit = action === 'kit';
      const result = await commit({ type: 'plant', slot: destination, species: kit ? 'chamomile' : species, pot: kit ? 'clay' : pot, kit });
      if (result?.plantedId) {
        selected = destination;
        if (draft === requestDraft) closeDialog();
        render();
      }
      break;
    }
    default:
      await commit({ type: action, slot, expectedId, id: data.id, value: Number(data.value), offset: Number(data.offset) });
  }
});

window.addEventListener('hashchange', () => { void parseLocation(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state) void commit(); });
await commit();
await parseLocation();
setInterval(async () => {
  if (document.hidden) return;
  const wasReady = Boolean(state);
  if (await commit() && !wasReady) await parseLocation();
}, 5000);
