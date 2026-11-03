import { categories, normalizeVideo, thumbnail, detailUrl, getWorkTypes } from './content-model.mjs';

const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function publicAsset(path) {
  return new URL(location.pathname.includes('/projects/') ? `../${path}` : path, location.href).href;
}
function poster(video) {
  if (video.type === 'mp4') {
    const media = make('video', 'work-study__poster-video');
    media.src = publicAsset(video.videoPath);
    if (video.posterPath) media.poster = publicAsset(video.posterPath);
    media.muted = true; media.playsInline = true; media.loop = true; media.preload = 'metadata';
    media.dataset.localPreview = '';
    return media;
  }
  const url = thumbnail(video);
  const image = make('img');
  image.src = url;
  image.alt = video.title;
  image.loading = 'lazy';
  image.decoding = 'async';
  const fallback = () => { if (!image.src.endsWith('/hqdefault.jpg')) image.src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`; };
  image.addEventListener('error', fallback);
  image.addEventListener('load', () => { if (image.naturalWidth <= 120) fallback(); });
  return image;
}
function card(video) {
  const article = make('article', 'work-study');
  article.dataset.managedVideo = video.id;
  article.dataset.workType = video.workType;
  const link = make('a', 'work-study__button');
  link.href = detailUrl(video);
  link.setAttribute('aria-label', `${video.title} — view project`);
  link.dataset.previewTitle = video.title;
  link.dataset.previewState = 'idle';
  link.dataset.previewType = video.type;
  const frame = make('span', 'work-study__image');
  frame.append(poster(video));
  const preview = make('span', 'work-study__preview');
  preview.setAttribute('aria-hidden', 'true');
  link.dataset.previewVideo = video.type === 'youtube' ? video.youtubeId : video.videoPath;
  if (video.type === 'youtube') {
    const mount = make('span');
    mount.dataset.previewMount = '';
    preview.append(mount);
    frame.append(preview);
  }
  link.append(frame, make('span', 'work-study__title', video.title));
  article.append(link);
  return article;
}
function showDetail(container, video) {
  container.replaceChildren();
  if (!video) {
    container.append(make('h1', 'work-detail__title', '영상을 찾을 수 없습니다.'));
    const back = make('a', 'back-to-work', '작품 목록으로 돌아가기');
    back.href = 'creature-rigging.html#works';
    container.append(back);
    return;
  }
  const category = categories.find(item => item.id === video.category);
  document.title = `${video.title} — JO JUNG HO`;
  const heading = make('h1', 'work-detail__title', video.title);
  heading.id = 'work-title';
  const media = make('div', 'work-detail__video');
  if (video.type === 'youtube') {
    const iframe = make('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}`;
    iframe.title = video.title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    media.append(iframe);
  } else if (video.type === 'mp4') {
    const player = make('video');
    player.src = publicAsset(video.videoPath);
    player.controls = true;
    player.playsInline = true;
    player.preload = 'metadata';
    if (video.posterPath) player.poster = publicAsset(video.posterPath);
    media.append(player);
  }
  container.append(heading, media);
  if (video.type === 'youtube') {
    const watch = make('div', 'work-detail__watch');
    const link = make('a', '', 'YouTube에서 보기 ↗');
    link.href = `https://www.youtube.com/watch?v=${video.youtubeId}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    watch.append(link);
    container.append(watch);
  }
  const info = make('section', 'work-detail__information');
  info.setAttribute('aria-label', '프로젝트 소개');
  const description = make('div', 'work-detail__description');
  description.append(make('p', '', video.description));
  const credits = make('dl', 'work-detail__credits');
  for (const [label, value] of [['Project', video.title], ['Category', category.title], ['Role', video.role], ['Channel', video.channel]]) {
    if (!value) continue;
    const item = make('div');
    item.append(make('dt', '', label), make('dd', '', value));
    credits.append(item);
  }
  info.append(description, credits);
  const navigation = make('nav', 'work-detail__back');
  const back = make('a', '', '← BACK TO WORKS');
  back.href = `${category.page}#works`;
  navigation.append(back);
  document.querySelectorAll('[data-category-back]').forEach(link => {
    link.href = back.href;
    link.textContent = `← ${category.title || 'WORKS'}`;
  });
  container.append(info, navigation);
}

const worksGrid = document.querySelector('[data-works-category]');
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  document.querySelectorAll('[data-local-video-manager]').forEach(link => { link.hidden = false; });
}
const filters = document.querySelector('[data-works-filters]');
let filterButtons = [...document.querySelectorAll('[data-work-filter]')];
let activeWorkFilter = 'all';
function renderWorkFilters(workTypes) {
  if (!filters || !worksGrid) return;
  filters.replaceChildren(...[{ id: 'all', title: 'ALL' }, ...workTypes].map(workType => {
    const button = make('button', '', workType.title);
    button.type = 'button';
    button.dataset.workFilter = workType.id;
    button.setAttribute('aria-controls', worksGrid.id);
    return button;
  }));
  filterButtons = [...filters.querySelectorAll('[data-work-filter]')];
}
function applyWorkFilter() {
  if (!worksGrid || !filterButtons.length) return;
  let visibleCount = 0;
  worksGrid.querySelectorAll('.work-study').forEach(article => {
    article.hidden = activeWorkFilter !== 'all' && article.dataset.workType !== activeWorkFilter;
    if (!article.hidden) visibleCount++;
  });
  filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workFilter === activeWorkFilter)));
  const empty = document.querySelector('[data-works-empty]');
  if (empty) empty.hidden = visibleCount > 0;
  document.dispatchEvent(new Event('portfolio-works-filtered'));
}
filters?.addEventListener('click', event => {
  const button = event.target.closest('[data-work-filter]');
  if (!button || !filters.contains(button)) return;
  activeWorkFilter = button.dataset.workFilter;
  applyWorkFilter();
});
applyWorkFilter();

async function load() {
  const response = await fetch('../data/videos.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('목록을 불러오지 못했습니다.');
  const store = await response.json();
  const availableWorkTypes = getWorkTypes(store);
  renderWorkFilters(availableWorkTypes);
  const videos = store.videos.filter(video => !video.deletedAt).flatMap(video => {
    try { return [{ ...video, ...normalizeVideo(video, availableWorkTypes) }]; } catch { return []; }
  });
  const grid = document.querySelector('[data-works-category]');
  if (grid) {
    grid.querySelectorAll('[data-managed-video]').forEach(element => element.remove());
    const matches = videos.filter(video => video.category === grid.dataset.worksCategory);
    if (matches.length) {
      grid.classList.add('works-grid--video');
      grid.closest('.project-works').classList.add('project-works--tiles');
      const fragment = document.createDocumentFragment();
      matches.forEach(video => fragment.append(card(video)));
      grid.prepend(fragment);
    }
    applyWorkFilter();
    await import('./work-preview.js');
  }
  const detail = document.querySelector('[data-work-detail]');
  if (detail) {
    const id = detail.dataset.workId || new URLSearchParams(location.search).get('id');
    showDetail(detail, videos.find(video => video.id === id));
  }
}
load().catch(() => {
  const grid = document.querySelector('[data-works-category]');
  if (grid) import('./work-preview.js');
  const detail = document.querySelector('[data-work-detail]');
  if (detail && !detail.dataset.workId) detail.replaceChildren(make('p', '', '영상을 불러오지 못했습니다. 잠시 후 새로고침해주세요.'));
});
window.addEventListener('storage', event => {
  if (event.key === 'portfolio-content-updated') location.reload();
});
