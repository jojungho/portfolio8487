import { escapeHTML as e, normalizeProfile } from '../profile-model.mjs';

const $ = selector => document.querySelector(selector);
let saved, draft, selectedId, token = '', dirty = false, busy = false, replacingId = '';
const current = () => draft.careers.find(career => career.id === selectedId);
function message(value, error = false) { $('#status').textContent = value; $('#status').classList.toggle('is-error', error); }
function controls() {
  $('#profile-fields').disabled = busy || !draft;
  $('#save-profile').disabled = busy || !dirty;
  $('#reload-profile').disabled = busy || !draft;
}
function changed() { dirty = true; controls(); message('저장하지 않은 변경이 있습니다. 변경 저장을 눌러주세요.'); }
async function api(path, method = 'GET', body, binary = false) {
  const response = await fetch(`/api/admin/${path}`, { method, cache: 'no-store', headers: { 'Content-Type': binary ? 'application/octet-stream' : 'application/json', 'X-Portfolio-Token': token }, ...(body ? { body: binary ? body : JSON.stringify(body) } : {}) });
  let result;
  try { result = await response.json(); } catch { throw new Error('로컬 서버를 실행한 뒤 다시 열어주세요.'); }
  if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
  return result;
}
function renderSelector() {
  $('#career-select').innerHTML = draft.careers.map(career => `<option value="${e(career.id)}">${e(career.company || '새 경력')}</option>`).join('');
  $('#career-select').value = selectedId || '';
}
function field(key, label, maximum = 200, required = false, type = 'text') {
  return `<label>${label}<input data-career-field="${key}" type="${type}" value="${e(current()[key])}" maxlength="${maximum}" ${required ? 'required' : ''} /></label>`;
}
function renderCareer() {
  renderSelector();
  const career = current();
  if (!career) { $('#career-editor').innerHTML = '<p class="empty-gallery">＋ 경력 추가로 새 경력을 작성하세요.</p>'; return; }
  const index = draft.careers.indexOf(career);
  $('#career-editor').innerHTML = `<div class="career-editor-head"><h2>${e(career.company || '새 경력')}</h2><div class="career-order"><button type="button" class="button button-secondary" data-action="career-up" ${index === 0 ? 'disabled' : ''}>↑ 위로</button><button type="button" class="button button-secondary" data-action="career-down" ${index === draft.careers.length - 1 ? 'disabled' : ''}>↓ 아래로</button></div></div>
    <div class="career-fields">
      ${field('company', '회사명', 150, true)}${field('location', '지역', 100)}
      <div class="wide">${field('team', '부서 / 팀')}</div>
      ${field('start', '입사 연월', 7, true, 'month')}
      <label class="current-toggle"><input type="checkbox" data-career-field="current" ${career.current ? 'checked' : ''} />현재 재직 중</label>
      <label ${career.current ? 'hidden' : ''} id="end-field">퇴사 연월<input type="month" data-career-field="end" value="${e(career.end)}" ${career.current ? 'disabled' : 'required'} /></label>
      ${field('role', '담당 분야')}${field('position', '직책', 150)}
      <label class="wide">업무 내용 <span class="optional">한 줄에 하나씩 입력</span><textarea data-career-field="projects" maxlength="10000">${e(career.projects.join('\n'))}</textarea></label>
      <label class="wide">이미지 배치<select data-career-field="layout"><option value="video" ${career.layout === 'video' ? 'selected' : ''}>가로 16:9 — 동일한 크기</option><option value="poster" ${career.layout === 'poster' ? 'selected' : ''}>원본 비율 — 포스터 높이 맞춤</option></select></label>
    </div>
    <div class="gallery-heading"><div><h3>작품 이미지 <span>${career.images.length}</span></h3><p class="field-note">JPG · PNG · WebP / 파일당 10MB 이하 / 여러 장 선택 가능</p></div><button type="button" class="button button-secondary" data-action="add-images">＋ 이미지 추가</button></div>
    <div class="artwork-editor-grid">${career.images.map((image, i) => `<article class="artwork-editor-card" data-image-id="${e(image.id)}"><div class="artwork-preview" tabindex="0" aria-label="${e(image.title)} 타이틀 미리보기"><img src="../${e(image.src)}" alt="${e(image.alt)}" loading="lazy" /><span class="artwork-caption" aria-hidden="true">${e(image.title)}</span></div><div class="artwork-editor-body"><label>중앙 흰색 타이틀<input data-image-title="${e(image.id)}" value="${e(image.title)}" maxlength="200" required /></label><div class="artwork-actions"><button type="button" data-action="image-up" data-id="${e(image.id)}" aria-label="${e(image.title)} 앞으로" ${i === 0 ? 'disabled' : ''}>←</button><button type="button" data-action="image-down" data-id="${e(image.id)}" aria-label="${e(image.title)} 뒤로" ${i === career.images.length - 1 ? 'disabled' : ''}>→</button><button type="button" data-action="replace-image" data-id="${e(image.id)}">교체</button><button type="button" class="remove-image" data-action="remove-image" data-id="${e(image.id)}">삭제</button></div></div></article>`).join('')}</div>
    ${career.images.length ? '' : '<p class="empty-gallery">이미지를 추가하면 이곳에서 타이틀을 편집할 수 있습니다.</p>'}
    <button type="button" class="button button-secondary remove-career" data-action="remove-career">이 경력 삭제</button>`;
}
function render() {
  $('#profile-name').value = draft.name;
  $('#profile-specialty').value = draft.specialty;
  renderCareer(); controls();
}
async function load() {
  busy = true; controls();
  try {
    token = (await api('session')).token;
    saved = await api('profile');
    draft = structuredClone(saved);
    selectedId = draft.careers.some(career => career.id === selectedId) ? selectedId : draft.careers[0]?.id;
    dirty = false; render(); message('회사를 선택해 경력과 이미지 타이틀을 편집하세요.');
  } catch (failure) { message(failure.message, true); }
  finally { busy = false; controls(); }
}
$('#reload-profile').addEventListener('click', () => {
  if (dirty && !confirm('저장하지 않은 변경을 취소하고 마지막 저장 내용을 불러올까요?')) return;
  load();
});
$('#career-select').addEventListener('change', event => { selectedId = event.target.value; renderCareer(); });
$('#profile-form').addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'profile-name') draft.name = input.value;
  else if (input.id === 'profile-specialty') draft.specialty = input.value;
  else if (input.dataset.imageTitle) {
    const image = current().images.find(image => image.id === input.dataset.imageTitle);
    image.title = input.value;
    const card = input.closest('.artwork-editor-card');
    card.querySelector('.artwork-caption').textContent = input.value;
    card.querySelector('.artwork-preview').setAttribute('aria-label', `${input.value} 타이틀 미리보기`);
  } else if (input.dataset.careerField) {
    const key = input.dataset.careerField;
    current()[key] = key === 'current' ? input.checked : key === 'projects' ? input.value.split('\n') : input.value;
    if (key === 'company') { renderSelector(); $('.career-editor-head h2').textContent = input.value || '새 경력'; }
    if (key === 'current') {
      $('#end-field').hidden = input.checked;
      const end = $('#end-field input'); end.disabled = input.checked; end.required = !input.checked;
    }
  } else return;
  changed();
});
$('#add-career').addEventListener('click', () => {
  if (draft.careers.length >= 40) { message('경력은 최대 40개까지 추가할 수 있습니다.', true); return; }
  const career = { id: `career-${crypto.randomUUID()}`, company: '새 경력', location: '', team: '', start: new Date().toISOString().slice(0, 7), end: '', current: true, role: 'Rigging · CFX', position: '', projects: [], layout: 'video', images: [] };
  draft.careers.push(career); selectedId = career.id; renderCareer(); changed();
  $('[data-career-field="company"]').focus();
});
function move(list, index, offset) {
  if (index < 0 || index + offset < 0 || index + offset >= list.length) return;
  [list[index], list[index + offset]] = [list[index + offset], list[index]];
}
$('#career-editor').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || busy) return;
  const { action, id } = button.dataset;
  const career = current();
  if (action === 'add-images') { $('#image-files').click(); return; }
  if (action === 'replace-image') { replacingId = id; $('#replacement-file').click(); return; }
  if (action === 'remove-career') {
    if (!confirm(`“${career.company}” 경력을 목록에서 삭제할까요? 변경 저장 전에는 새로 불러오기로 되돌릴 수 있습니다.`)) return;
    draft.careers = draft.careers.filter(item => item.id !== career.id); selectedId = draft.careers[0]?.id;
  } else if (action.startsWith('career-')) move(draft.careers, draft.careers.indexOf(career), action === 'career-up' ? -1 : 1);
  else if (action === 'remove-image') career.images = career.images.filter(image => image.id !== id);
  else move(career.images, career.images.findIndex(image => image.id === id), action === 'image-up' ? -1 : 1);
  renderCareer(); changed();
});
async function uploadImage(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: 10MB 이하의 이미지를 선택해주세요.`);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP 파일을 선택해주세요.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth > 20000 || image.naturalHeight > 20000) throw new Error('이미지 크기가 너무 큽니다.');
    const result = await api('profile/images', 'POST', file, true);
    return { ...result, width: image.naturalWidth, height: image.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}
async function addFiles(files, replace = '') {
  if (!files.length || busy) return;
  const career = current();
  if (!replace && career.images.length + files.length > 100) { message('회사별 이미지는 최대 100장까지 추가할 수 있습니다.', true); return; }
  busy = true; controls();
  try {
    for (const [i, file] of files.entries()) {
      message(`이미지 ${i + 1} / ${files.length} 준비 중…`);
      const uploaded = await uploadImage(file);
      if (replace) Object.assign(career.images.find(image => image.id === replace), uploaded);
      else {
        const title = file.name.replace(/\.[^.]+$/, '').slice(0, 200) || '새 작품';
        career.images.push({ ...uploaded, id: `image-${crypto.randomUUID()}`, title, alt: title });
      }
      dirty = true;
    }
    message('이미지를 준비했습니다. 중앙 타이틀을 입력하고 변경 저장을 눌러주세요.');
  } catch (failure) { message(`${failure.message} 준비된 이미지는 유지됩니다.`, true); }
  finally { busy = false; renderCareer(); controls(); }
}
$('#image-files').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files); });
$('#replacement-file').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files, replacingId); });
$('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !dirty) return;
  let profile;
  try { profile = normalizeProfile(draft); } catch (failure) { message(failure.message, true); return; }
  busy = true; controls(); message('변경 내용을 저장하는 중입니다…');
  try {
    saved = await api('profile', 'PUT', { ...profile, revision: saved.revision });
    draft = structuredClone(saved); dirty = false;
    try { localStorage.setItem('portfolio-profile-updated', String(Date.now())); } catch { /* Storage may be disabled. */ }
    if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('portfolio-profile'); channel.postMessage('saved'); channel.close(); }
    render(); message('저장했습니다. 프로필 보기를 누르면 변경된 내용을 확인할 수 있습니다.');
  } catch (failure) { message(failure.message, true); }
  finally { busy = false; controls(); }
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
load();
