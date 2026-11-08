export const categories = [
  { id: 'game-cinematic', title: 'CINEMATIC&VFX', page: 'creature-rigging.html' },
  { id: 'vfx', title: 'PROFILE', page: 'cloth-simulation.html' },
  { id: 'rnd', title: '', adminTitle: '카테고리 3', page: 'character-work.html', locked: true },
  { id: '2d', title: '', adminTitle: '카테고리 4', page: 'destruction-fx.html', locked: true },
  { id: 'project-5', title: '카테고리 5', page: 'fluid-effects.html', locked: true },
  { id: 'project-6', title: '카테고리 6', page: 'procedural-rd.html', locked: true },
];
export const workTypes = [
  { id: 'showreel', title: 'ShowReel' },
  { id: 'rigging', title: 'Rigging' },
];
export function getWorkTypes(store = {}) {
  const result = workTypes.map(item => ({ ...item }));
  for (const item of Array.isArray(store.workTypes) ? store.workTypes : []) {
    if (!item || typeof item.id !== 'string' || !/^work-[\w-]+$/.test(item.id) ||
        typeof item.title !== 'string' || !item.title.trim() || item.title.length > 40 ||
        result.some(existing => existing.id === item.id)) continue;
    result.push({ id: item.id, title: item.title });
  }
  return result;
}
export function normalizeWorkTypeTitle(value, availableTypes) {
  if (typeof value !== 'string') throw new Error('새 분류 이름을 입력해주세요.');
  const title = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!title) throw new Error('새 분류 이름을 입력해주세요.');
  if (title.length > 40) throw new Error('분류 이름은 40자 이내로 입력해주세요.');
  const key = title.toLocaleLowerCase();
  if (['all', '전체'].includes(key) || availableTypes.some(item => item.title.normalize('NFKC').toLocaleLowerCase() === key)) {
    throw new Error('이미 사용 중인 분류 이름입니다. 다른 이름을 입력해주세요.');
  }
  return title;
}
export function normalizeHeroSlots(value = []) {
  if (!Array.isArray(value) || value.some(slot => slot !== 1 && slot !== 2)) throw new Error('1단 영상은 1 또는 2를 선택해주세요.');
  return [...new Set(value)].sort();
}
export function assignHeroSlots(videos, video, slots, now) {
  video.heroSlots = normalizeHeroSlots(slots);
  for (const other of videos) {
    if (other.id === video.id) continue;
    const previous = other.heroSlots || [];
    const next = previous.filter(slot => !video.heroSlots.includes(slot));
    if (next.length !== previous.length) {
      other.heroSlots = next;
      other.updatedAt = now;
    }
  }
}
export function youtubeId(value) {
  const text = String(value || '').trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { return ''; }
  if (!['https:', 'http:'].includes(url.protocol)) return '';
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id = '';
  if (host === 'youtu.be') id = parts[0];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
    id = url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '');
  }
  return /^[\w-]{11}$/.test(id || '') ? id : '';
}
export function normalizeVideo(input, availableWorkTypes = workTypes) {
  if (!input || typeof input !== 'object') throw new Error('영상 정보를 입력해주세요.');
  const field = (name, limit, required = false) => {
    const value = String(input[name] || '').trim();
    if (required && !value) throw new Error('제목을 입력해주세요.');
    if (value.length > limit) throw new Error(`${name} 입력 길이가 너무 깁니다.`);
    return value;
  };
  const category = categories.find(item => item.id === input.category);
  if (!category) throw new Error('카테고리를 선택해주세요.');
  if (category.locked) throw new Error('잠긴 카테고리입니다. 잠금 해제 후 영상을 추가해주세요.');
  const workType = input.workType || 'showreel';
  if (!availableWorkTypes.some(item => item.id === workType)) throw new Error('WORKS 분류를 선택해주세요.');
  const record = {
    title: field('title', 120, true), category: input.category, workType, showOnHomepage: input.showOnHomepage !== false,
    description: field('description', 4000), role: field('role', 200), channel: field('channel', 200),
    type: input.type, heroSlots: normalizeHeroSlots(input.heroSlots),
  };
  if (input.type === 'youtube') {
    record.youtubeId = youtubeId(input.url || input.youtubeId);
    if (!record.youtubeId) throw new Error('올바른 YouTube 영상 주소를 입력해주세요.');
  } else if (input.type === 'mp4') {
    const videoPath = field('url', 240) || field('videoPath', 240, true);
    if (!/^assets\/videos\/[A-Za-z0-9._-]+\.mp4$/i.test(videoPath)) {
      throw new Error('MP4 경로는 assets/videos/파일명.mp4 형식으로 입력해주세요.');
    }
    record.videoPath = videoPath;
    const posterPath = field('posterPath', 240);
    if (posterPath && !/^assets\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/i.test(posterPath)) {
      throw new Error('표지 이미지 경로는 assets/ 안의 PNG, JPG, 또는 WebP 파일이어야 합니다.');
    }
    if (posterPath.split('/').includes('..')) throw new Error('표지 이미지 경로를 확인해주세요.');
    if (posterPath) record.posterPath = posterPath;
  } else throw new Error('영상 종류를 선택해주세요.');
  return record;
}
export function thumbnail(video) {
  if (video.posterPath) return video.posterPath;
  return video.type === 'youtube' ? `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg` : '';
}
export function detailUrl(video) {
  return video.id === 'bt21' && video.type === 'youtube' ? 'bt21.html' : `work.html?id=${encodeURIComponent(video.id)}`;
}
