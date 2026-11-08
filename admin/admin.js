import { categories, getWorkTypes, normalizeWorkTypeTitle, youtubeId, detailUrl } from '../content-model.mjs';

const $ = selector => document.querySelector(selector);
const adminAsset = path => new URL(`../${path}`, location.href).href;
const editor = $('#editor');
const form = $('#video-form');
const status = $('#status');
let token = '';
let store = { revision: 0, videos: [] };
let editingId = null;
let trash = false;
let busy = false;
let metadataRequest = 0;
let metadataTimer;
let autoTitle = '';
let orderState = null;
let draggingId = null;
const fields = { type: $('#video-type'), url: $('#video-url'), posterPath: $('#video-poster'), title: $('#video-title'), category: $('#video-category'), workType: $('#video-work-type'), description: $('#video-description'), role: $('#video-role'), channel: $('#video-channel') };
const heroSlotInputs = [...form.querySelectorAll('input[name="heroSlots"]')];
const homeVisibility = $('#show-on-homepage');
const node = (tag, className, text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};
function message(text, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
function refreshWorkTypes(selected = fields.workType.value) {
  fields.workType.replaceChildren(...getWorkTypes(store).map(workType => {
    const option = node('option', '', workType.title);
    option.value = workType.id;
    return option;
  }));
  fields.workType.value = getWorkTypes(store).some(item => item.id === selected) ? selected : 'showreel';
}
function workTypeMessage(text = '', error = false) {
  $('#work-type-message').textContent = text;
  $('#work-type-message').hidden = !text;
  $('#work-type-message').classList.toggle('is-error', error);
}
function toggleWorkTypeCreate(open) {
  $('#work-type-create').hidden = !open;
  $('#add-work-type').setAttribute('aria-expanded', String(open));
  $('#new-work-type').value = '';
  workTypeMessage();
  if (open) $('#new-work-type').focus();
}
async function addWorkType() {
  if (busy) return;
  let title;
  try { title = normalizeWorkTypeTitle($('#new-work-type').value, getWorkTypes(store)); }
  catch (error) { workTypeMessage(error.message, true); $('#new-work-type').focus(); return; }
  setBusy(true);
  workTypeMessage('분류를 추가하는 중입니다…');
  try {
    store = await api('work-types', 'POST', { revision: store.revision, title });
    const created = getWorkTypes(store).find(item => item.title === title);
    render();
    fields.workType.value = created.id;
    toggleWorkTypeCreate(false);
    notifyChange();
    workTypeMessage(`“${title}” 분류를 추가했습니다. 변경 저장을 누르면 이 영상에도 적용됩니다.`);
  } catch (error) { workTypeMessage(error.message, true); }
  finally { setBusy(false); if ($('#work-type-create').hidden) fields.workType.focus(); }
}
async function api(path, method = 'GET', body) {
  const response = await fetch(`/api/admin/${path}`, {
    method, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Portfolio-Token': token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('로컬 서버를 실행한 뒤 관리 화면을 열어주세요.'); }
  if (!response.ok) {
    if (response.status === 409) { store = await api('videos'); orderState = null; render(); }
    throw new Error(result.error || '저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return result;
}
function notifyChange() {
  try { localStorage.setItem('portfolio-content-updated', String(Date.now())); } catch {}
}
function orderChanged() {
  return Boolean(orderState && orderState.ids.some((id, index) => id !== orderState.originalIds[index]));
}
function updateControls() {
  const ordering = Boolean(orderState);
  const category = $('#filter-category').value;
  const count = store.videos.filter(video => !video.deletedAt && (!category || video.category === category)).length;
  $('#change-order').hidden = trash || ordering;
  $('#change-order').disabled = busy || !token || count === 0;
  $('#add-video').disabled = busy || !token || ordering;
  ['#search', '#filter-category', '#show-active', '#show-trash'].forEach(selector => { $(selector).disabled = busy || ordering; });
  $('#order-toolbar').hidden = !ordering;
  $('#save-order').disabled = busy || !orderChanged();
  $('#cancel-order').disabled = busy;
  $('#save-order').textContent = busy && ordering ? '저장 중…' : '순서 저장';
  $('#video-list').classList.toggle('is-reordering', ordering);
  $('#video-list').setAttribute('aria-busy', String(busy));
  $('#video-list').querySelectorAll('button').forEach(button => { button.disabled = busy || button.dataset.boundary === 'true'; });
  $('#video-list').querySelectorAll('[data-drag-handle]').forEach(handle => { handle.draggable = ordering && !busy && count > 1; });
}
function clearDropTargets() {
  $('#video-list').querySelectorAll('.is-drop-before, .is-drop-after').forEach(card => card.classList.remove('is-drop-before', 'is-drop-after'));
}
function endDrag() {
  draggingId = null;
  clearDropTargets();
  $('#video-list').querySelectorAll('.is-dragging').forEach(card => card.classList.remove('is-dragging'));
}
function announceMove(id) {
  const video = store.videos.find(item => item.id === id);
  message(`“${video.title}”을 ${orderState.ids.indexOf(id) + 1}번째로 옮겼습니다. 순서 저장을 눌러 반영하세요.`);
}
function moveOrder(id, direction) {
  if (busy || !orderState) return;
  const index = orderState.ids.indexOf(id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= orderState.ids.length) return;
  orderState.ids.splice(index, 1);
  orderState.ids.splice(destination, 0, id);
  render();
  const card = [...$('#video-list').children].find(item => item.dataset.videoId === id);
  const button = card?.querySelector(direction < 0 ? '[data-move="previous"]' : '[data-move="next"]');
  (button?.disabled ? card.querySelector('[data-drag-handle]') : button)?.focus({ preventScroll: true });
  announceMove(id);
}
function enableOrdering(card, video, index, actions) {
  const handle = node('button', 'drag-handle');
  handle.type = 'button';
  handle.dataset.dragHandle = '';
  handle.setAttribute('aria-label', `${video.title} 순서 변경 손잡이. 앞·뒤 이동 버튼으로도 변경할 수 있습니다.`);
  const grip = node('span', 'drag-handle__grip', '⠿');
  grip.setAttribute('aria-hidden', 'true');
  handle.append(grip, node('span', '', `${String(index + 1).padStart(2, '0')} · 드래그`));
  actions.append(handle);
  for (const [direction, label, name] of [[-1, '← 앞으로', 'previous'], [1, '뒤로 →', 'next']]) {
    const button = node('button', 'order-step', label);
    button.type = 'button';
    button.dataset.move = name;
    button.dataset.boundary = String(index + direction < 0 || index + direction >= orderState.ids.length);
    button.setAttribute('aria-label', `${video.title} ${direction < 0 ? '앞으로' : '뒤로'} 이동`);
    button.addEventListener('click', () => moveOrder(video.id, direction));
    actions.append(button);
  }
  handle.addEventListener('dragstart', event => {
    if (busy || !orderState) { event.preventDefault(); return; }
    draggingId = video.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', video.id);
    event.dataTransfer.setDragImage(card, card.clientWidth / 2, 30);
    card.classList.add('is-dragging');
  });
  handle.addEventListener('dragend', endDrag);
  const placeAfter = event => {
    const rect = card.getBoundingClientRect();
    const columns = getComputedStyle($('#video-list')).gridTemplateColumns.split(' ').length;
    return columns === 1 ? event.clientY > rect.top + rect.height / 2 : event.clientX > rect.left + rect.width / 2;
  };
  card.addEventListener('dragover', event => {
    if (busy || !orderState || !draggingId || draggingId === video.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropTargets();
    card.classList.add(placeAfter(event) ? 'is-drop-after' : 'is-drop-before');
  });
  card.addEventListener('dragleave', event => {
    if (!card.contains(event.relatedTarget)) card.classList.remove('is-drop-before', 'is-drop-after');
  });
  card.addEventListener('drop', event => {
    if (busy || !orderState || !draggingId) return;
    event.preventDefault();
    const id = draggingId;
    const after = placeAfter(event);
    endDrag();
    if (id === video.id || !orderState.ids.includes(id)) return;
    const ids = orderState.ids.filter(item => item !== id);
    const target = ids.indexOf(video.id);
    if (target < 0) return;
    ids.splice(target + Number(after), 0, id);
    orderState.ids = ids;
    render();
    const moved = [...$('#video-list').children].find(item => item.dataset.videoId === id);
    moved?.querySelector('[data-drag-handle]')?.focus({ preventScroll: true });
    announceMove(id);
  });
}
function startOrdering() {
  if (busy || trash || orderState) return;
  const category = $('#filter-category').value;
  const ids = store.videos.filter(video => !video.deletedAt && (!category || video.category === category)).map(video => video.id);
  if (!ids.length) return;
  $('#search').value = '';
  orderState = { category, ids: [...ids], originalIds: ids, revision: store.revision };
  const label = categories.find(item => item.id === category);
  $('#order-title').textContent = `${label ? label.adminTitle || label.title : '모든 카테고리'} · 순서 변경`;
  $('#order-help').textContent = ids.length < 2 ? '영상이 2개 이상 등록되면 순서를 바꿀 수 있습니다.' : '손잡이를 드래그하거나 앞·뒤 이동 버튼을 누른 뒤 저장하세요.';
  render();
  message('왼쪽에서 오른쪽, 위에서 아래 순서로 표시됩니다. 저장하면 홈페이지에도 반영됩니다.');
  $('#video-list').querySelector('[data-drag-handle]')?.focus({ preventScroll: true });
}
function cancelOrdering() {
  if (busy) return;
  endDrag(); orderState = null;
  render(); message('순서 변경을 취소했습니다.'); $('#change-order').focus();
}
async function saveOrdering() {
  if (busy || !orderChanged()) return;
  endDrag(); setBusy(true);
  try {
    store = await api('videos/order', 'PATCH', { revision: orderState.revision, category: orderState.category, ids: orderState.ids });
    orderState = null;
    notifyChange(); render(); message('영상 순서를 저장했습니다. 포트폴리오에도 반영되었습니다.');
  } catch (error) { message(error.message, true); }
  finally { setBusy(false); if (!orderState) $('#change-order').focus(); }
}
function render() {
  refreshWorkTypes();
  const active = store.videos.filter(video => !video.deletedAt);
  $('#count').textContent = active.length;
  $('#trash-count').textContent = store.videos.length - active.length;
  const query = $('#search').value.trim().toLowerCase();
  const category = $('#filter-category').value;
  const visible = orderState ? orderState.ids.map(id => store.videos.find(video => video.id === id)).filter(Boolean) : store.videos.filter(video => Boolean(video.deletedAt) === trash && (!category || video.category === category) && video.title.toLowerCase().includes(query));
  const list = $('#video-list');
  list.replaceChildren();
  visible.forEach((video, index) => {
    const card = node('article', 'video-card');
    card.dataset.videoId = video.id;
    const image = node('div', 'video-card__image');
    if (video.type === 'mp4') {
      const preview = node('video');
      preview.src = adminAsset(video.videoPath);
      if (video.posterPath) preview.poster = adminAsset(video.posterPath);
      preview.muted = true; preview.playsInline = true; preview.preload = 'metadata';
      image.append(preview, node('span', 'video-card__badge', 'LOCAL MP4'));
    } else {
      const img = node('img');
      img.src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
      img.alt = video.title;
      img.loading = 'lazy';
      img.draggable = false;
      image.append(img, node('span', 'video-card__badge', 'YOUTUBE'));
    }
    const body = node('div', 'video-card__body');
    const category = categories.find(item => item.id === video.category);
    body.append(node('p', 'video-card__category', category?.adminTitle || category?.title || ''), node('h2', '', video.title), node('p', 'video-card__description', video.description || '작품 설명을 추가할 수 있습니다.'));
    if (!video.deletedAt && video.heroSlots?.length) body.append(node('p', 'video-card__category', `1단 연결 · ${video.heroSlots.map(slot => `VIDEO 0${slot}`).join(' / ')}`));
    const actions = node('div', 'card-actions');
    const action = (label, className, callback) => {
      const button = node('button', className, label);
      button.type = 'button';
      button.addEventListener('click', callback);
      actions.append(button);
    };
    if (orderState) enableOrdering(card, video, index, actions);
    else if (trash) action('복원', '', () => changeTrash(video, true));
    else {
      action('수정', '', () => openEditor(video));
      const view = node('a', '', '상세 보기 ↗');
      view.href = `../projects/${detailUrl(video)}`;
      view.target = '_blank'; view.rel = 'noopener';
      actions.append(view);
      action('삭제', 'delete', () => changeTrash(video, false));
    }
    body.append(actions); card.append(image, body); list.append(card);
  });
  $('#empty').hidden = visible.length > 0;
  $('#empty-title').textContent = query || category ? '조건에 맞는 영상이 없습니다.' : trash ? '휴지통이 비어 있습니다.' : '첫 작품을 추가해보세요.';
  $('#empty-copy').textContent = trash ? '삭제한 영상은 이곳에서 복원할 수 있습니다.' : 'YouTube 링크나 assets/videos 폴더의 MP4를 등록할 수 있습니다.';
  updateControls();
}
function updatePreview() {
  const local = fields.type.value === 'mp4';
  const id = local ? '' : youtubeId(fields.url.value);
  const preview = $('#thumbnail-preview');
  if (local && /^assets\/videos\/[A-Za-z0-9._-]+\.mp4$/i.test(fields.url.value.trim())) {
    const path = fields.url.value.trim();
    const posterPath = fields.posterPath.value.trim();
    if (preview.dataset.videoPath !== path || preview.dataset.posterPath !== posterPath) {
      const video = node('video');
      video.src = adminAsset(path);
      if (posterPath) video.poster = adminAsset(posterPath);
      video.muted = true; video.playsInline = true; video.controls = true; video.preload = 'metadata';
      preview.replaceChildren(video);
      preview.dataset.videoPath = path;
      preview.dataset.posterPath = posterPath;
      delete preview.dataset.videoId;
    }
  } else if (id) {
    if (preview.dataset.videoId !== id) {
      const image = node('img');
      image.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      image.alt = '유튜브 영상 썸네일';
      preview.replaceChildren(image); preview.dataset.videoId = id;
      delete preview.dataset.videoPath; delete preview.dataset.posterPath;
    }
  } else { preview.replaceChildren(node('span', '', local ? 'assets/videos/파일명.mp4 경로를 입력하세요.' : 'YouTube 링크를 입력하면 썸네일이 표시됩니다.')); delete preview.dataset.videoId; delete preview.dataset.videoPath; delete preview.dataset.posterPath; }
  $('#preview-title').textContent = fields.title.value || '새로운 작품';
}
function updateSourceFields() {
  const local = fields.type.value === 'mp4';
  fields.url.type = local ? 'text' : 'url';
  fields.url.placeholder = local ? 'assets/videos/hero-reel.mp4' : 'https://www.youtube.com/watch?v=…';
  $('#video-url-label').innerHTML = `${local ? 'MP4 파일 경로' : '유튜브 링크'} <span class="required">*</span>`;
  $('#fetch-title').hidden = local;
  $('#mp4-options').hidden = !local;
  $('#youtube-note').hidden = local;
  $('#metadata-note').textContent = local ? '프로젝트 폴더의 assets/videos 안에 MP4 파일을 먼저 넣고, 경로를 입력하세요.' : '링크를 넣으면 영상 제목을 자동으로 가져옵니다. 제목은 직접 바꿀 수 있습니다.';
  updatePreview();
}
async function fetchMetadata() {
  const id = youtubeId(fields.url.value);
  if (!id) { $('#metadata-note').textContent = '올바른 유튜브 영상 주소를 입력해주세요.'; return; }
  const request = ++metadataRequest;
  $('#metadata-note').textContent = '유튜브에서 영상 정보를 가져오는 중입니다…';
  try {
    const metadata = await api(`youtube?url=${encodeURIComponent(fields.url.value)}`);
    if (request !== metadataRequest || !editor.open || id !== youtubeId(fields.url.value)) return;
    if (!fields.title.value.trim() || fields.title.value === autoTitle) fields.title.value = metadata.title;
    autoTitle = metadata.title;
    if (!fields.channel.value.trim()) fields.channel.value = metadata.channel;
    $('#metadata-note').textContent = '영상 정보를 가져왔습니다. 작품 제목과 설명은 자유롭게 수정하세요.';
    updatePreview();
  } catch (error) {
    if (request === metadataRequest && editor.open) $('#metadata-note').textContent = '정보를 자동으로 가져오지 못했습니다. 제목을 직접 입력하면 저장할 수 있습니다.';
  }
}
function openEditor(video) {
  if (busy || orderState) return;
  clearTimeout(metadataTimer); metadataRequest++;
  editingId = video?.id || null;
  autoTitle = '';
  form.reset();
  fields.type.value = video?.type || 'youtube';
  fields.posterPath.value = video?.posterPath || '';
  updateSourceFields();
  refreshWorkTypes(video?.workType || 'showreel');
  toggleWorkTypeCreate(false);
  fields.category.value = video?.category || $('#filter-category').value || 'game-cinematic';
  fields.workType.value = video?.workType || 'showreel';
  heroSlotInputs.forEach(input => { input.checked = (video?.heroSlots || []).includes(Number(input.value)); });
  homeVisibility.checked = video?.showOnHomepage !== false;
  $('#hero-slot-current').textContent = [1, 2].map(slot => {
    const current = store.videos.find(item => !item.deletedAt && item.heroSlots?.includes(slot));
    return `${slot}번 현재: ${current?.title || '테스트 영상'}`;
  }).join(' / ');
  for (const name of ['title', 'description', 'role', 'channel']) fields[name].value = video?.[name] || '';
  fields.url.value = video ? (video.type === 'mp4' ? video.videoPath : `https://www.youtube.com/watch?v=${video.youtubeId}`) : '';
  $('#editor-title').textContent = video ? '영상 수정' : '영상 추가';
  $('#save-video').textContent = video ? '변경 저장' : '영상 저장';
  $('#form-error').textContent = '';
  updatePreview();
  editor.showModal(); fields.url.focus();
}
function setBusy(value) {
  busy = value;
  form.querySelectorAll('input,textarea,select,button').forEach(element => { element.disabled = value; });
  updateControls();
}
async function changeTrash(video, restore) {
  if (busy || orderState) return;
  if (!restore && !confirm(`“${video.title}”을 휴지통으로 이동할까요?\n나중에 복원할 수 있습니다.`)) return;
  setBusy(true);
  try {
    store = await api(`videos/${encodeURIComponent(video.id)}${restore ? '/restore' : ''}`, restore ? 'POST' : 'DELETE', { revision: store.revision });
    notifyChange(); render(); message(restore ? '영상을 복원했습니다.' : '휴지통으로 이동했습니다.');
  } catch (error) { message(error.message, true); }
  finally { setBusy(false); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !form.reportValidity()) return;
  if (!$('#work-type-create').hidden) { workTypeMessage('분류 추가를 완료하거나 취소한 뒤 영상을 저장해주세요.', true); $('#new-work-type').focus(); return; }
  const isMp4 = fields.type.value === 'mp4';
  if (isMp4 ? !/^assets\/videos\/[A-Za-z0-9._-]+\.mp4$/i.test(fields.url.value.trim()) : !youtubeId(fields.url.value)) {
    $('#form-error').textContent = isMp4 ? 'assets/videos/파일명.mp4 형식의 경로를 입력해주세요.' : '올바른 유튜브 영상 주소를 입력해주세요.'; return;
  }
  metadataRequest++; clearTimeout(metadataTimer);
  const video = { type: fields.type.value };
  Object.entries(fields).forEach(([name, element]) => { video[name] = element.value.trim(); });
  video.heroSlots = heroSlotInputs.filter(input => input.checked).map(input => Number(input.value));
  video.showOnHomepage = homeVisibility.checked;
  setBusy(true); $('#form-error').textContent = ''; $('#save-video').textContent = '저장 중…';
  try {
    store = await api(editingId ? `videos/${encodeURIComponent(editingId)}` : 'videos', editingId ? 'PATCH' : 'POST', { revision: store.revision, video });
    notifyChange(); render(); editor.close(); message('저장했습니다. 포트폴리오에 반영되었습니다.');
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { setBusy(false); $('#save-video').textContent = editingId ? '변경 저장' : '영상 저장'; }
});
$('#add-video').addEventListener('click', () => openEditor());
$('#add-work-type').addEventListener('click', () => { if (!busy) toggleWorkTypeCreate($('#work-type-create').hidden); });
$('#save-work-type').addEventListener('click', addWorkType);
$('#cancel-work-type').addEventListener('click', () => { if (!busy) { toggleWorkTypeCreate(false); $('#add-work-type').focus(); } });
$('#new-work-type').addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Enter') { event.preventDefault(); addWorkType(); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) { toggleWorkTypeCreate(false); $('#add-work-type').focus(); } }
});
$('#change-order').addEventListener('click', startOrdering);
$('#cancel-order').addEventListener('click', cancelOrdering);
$('#save-order').addEventListener('click', saveOrdering);
window.addEventListener('beforeunload', event => {
  if (orderChanged()) { event.preventDefault(); event.returnValue = ''; }
});
['#close-editor', '#cancel-editor'].forEach(selector => $(selector).addEventListener('click', () => { if (!busy) editor.close(); }));
editor.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
editor.addEventListener('close', () => { metadataRequest++; clearTimeout(metadataTimer); });
fields.type.addEventListener('change', () => { metadataRequest++; clearTimeout(metadataTimer); updateSourceFields(); fields.url.focus(); });
fields.url.addEventListener('input', () => { metadataRequest++; updatePreview(); clearTimeout(metadataTimer); if (fields.type.value === 'youtube' && youtubeId(fields.url.value)) metadataTimer = setTimeout(fetchMetadata, 650); });
fields.posterPath.addEventListener('input', updatePreview);
fields.title.addEventListener('input', updatePreview);
$('#fetch-title').addEventListener('click', fetchMetadata);
$('#search').addEventListener('input', render);
$('#filter-category').addEventListener('change', render);
function selectTrash(value) {
  if (busy || orderState) return;
  trash = value;
  for (const [selector, active] of [['#show-active', !trash], ['#show-trash', trash]]) { $(selector).classList.toggle('is-active', active); $(selector).setAttribute('aria-pressed', String(active)); }
  render();
}
$('#show-active').addEventListener('click', () => selectTrash(false));
$('#show-trash').addEventListener('click', () => selectTrash(true));
categories.forEach(category => {
  for (const select of [fields.category, $('#filter-category')]) {
    const label = category.adminTitle || category.title;
    const option = node('option', '', category.locked ? `${label} · 잠금` : label);
    option.value = category.id;
    option.disabled = Boolean(category.locked);
    select.append(option);
  }
});
const initialCategory = new URLSearchParams(location.search).get('category');
if (categories.some(category => category.id === initialCategory && !category.locked)) $('#filter-category').value = initialCategory;
refreshWorkTypes();
try {
  const session = await api('session'); token = session.token;
  store = await api('videos'); render(); $('#add-video').disabled = false;
  message('모든 변경 사항이 로컬 파일에 저장됩니다.');
} catch (error) { message('관리 서버에 연결할 수 없습니다. start-preview.cmd를 실행한 뒤 새로고침해주세요.', true); }
