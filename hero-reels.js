import { normalizeVideo, getWorkTypes } from './content-model.mjs';

const hero = document.querySelector('#portfolio');
const status = hero.querySelector('#hero-reel-status');
const buttons = [...hero.querySelectorAll('[data-reel-index]')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const reels = [...hero.querySelectorAll('[data-hero-reel]')].map((video, index) => ({
  video, index, surface: video,
  title: `배경 영상 ${String(index + 1).padStart(2, '0')}`,
}));
let activeIndex = 0;
let requestId = 0;
let loaded = false;
let explicitPlayback = false;
let inView = hero.getBoundingClientRect().bottom > 0 && hero.getBoundingClientRect().top < innerHeight;
let apiPromise;
const eligible = () => loaded && inView && !document.hidden && (!motion.matches || explicitPlayback);
const selected = reel => reel === reels[activeIndex] && eligible();

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => reject(new Error('YouTube API timeout')), 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previousReady?.();
      resolve(window.YT);
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('YouTube unavailable')); };
    document.head.append(script);
  }).catch(error => { apiPromise = null; throw error; });
  return apiPromise;
}

function pause(reel) {
  clearTimeout(reel.playbackTimeout);
  reel.video.pause();
  if (reel.ready) reel.player.pauseVideo();
}
function pauseAll() { reels.forEach(pause); }
function showPoster() {
  pauseAll();
  reels.forEach(reel => reel.surface.classList.remove('is-live'));
}
function reveal(reel) {
  if (!selected(reel)) { pause(reel); return; }
  clearTimeout(reel.playbackTimeout);
  reel.surface.classList.add('is-live');
  reel.surface.dataset.playback = 'playing';
  reels.forEach(other => {
    if (other !== reel) { other.surface.classList.remove('is-live'); pause(other); }
  });
}
function unavailable(reel) {
  pause(reel);
  const hasLocalFrame = !reel.youtubeId && reel.video.readyState >= 2;
  reel.surface.classList.toggle('is-live', hasLocalFrame);
  reel.surface.dataset.playback = 'unavailable';
  if (reel === reels[activeIndex]) status.textContent = hasLocalFrame ? '영상의 첫 프레임을 표시하고 있습니다. VIDEO 버튼을 눌러 다시 시도할 수 있습니다.' : '영상을 재생할 수 없습니다. VIDEO 버튼을 눌러 다시 시도할 수 있습니다.';
}
function sizePlayer(reel) {
  if (!reel.ready) return;
  const { width, height } = hero.getBoundingClientRect();
  const playerWidth = Math.max(width, height * 16 / 9);
  const iframe = reel.player.getIframe();
  iframe.style.width = `${playerWidth}px`;
  iframe.style.height = `${playerWidth * 9 / 16}px`;
}
function prepare(reel) {
  if (reel.preparation) return reel.preparation;
  reel.preparation = loadYouTubeAPI().then(YT => new Promise((resolve, reject) => {
    const mount = document.createElement('div');
    reel.surface.replaceChildren(mount);
    const timeout = setTimeout(() => reject(new Error('YouTube player timeout')), 15000);
    reel.player = new YT.Player(mount, {
      host: 'https://www.youtube-nocookie.com', videoId: reel.youtubeId,
      width: '100%', height: '100%',
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady(event) {
          clearTimeout(timeout);
          reel.player = event.target;
          reel.ready = true;
          const iframe = reel.player.getIframe();
          iframe.title = `${reel.title} — 음소거 배경 영상`;
          iframe.tabIndex = -1;
          iframe.setAttribute('aria-hidden', 'true');
          iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
          reel.player.mute();
          sizePlayer(reel);
          resolve();
        },
        onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) reveal(reel);
          else if (event.data === YT.PlayerState.PAUSED) reel.surface.dataset.playback = 'paused';
          else if (event.data === YT.PlayerState.ENDED && selected(reel)) play(true);
        },
        onAutoplayBlocked() { unavailable(reel); },
        onError() {
          clearTimeout(timeout);
          if (!reel.ready) reject(new Error('YouTube video unavailable'));
          unavailable(reel);
        },
      },
    });
  })).catch(error => {
    reel.player?.destroy();
    reel.player = null;
    reel.ready = false;
    reel.preparation = null;
    throw error;
  });
  return reel.preparation;
}
async function play(restart = false) {
  if (!eligible()) return;
  const reel = reels[activeIndex];
  const request = ++requestId;
  reel.surface.dataset.playback = 'loading';
  try {
    if (reel.youtubeId) {
      await prepare(reel);
      if (request !== requestId || !selected(reel)) return;
      reel.player.mute();
      if (restart) reel.player.seekTo(0, true);
      clearTimeout(reel.playbackTimeout);
      reel.playbackTimeout = setTimeout(() => { if (selected(reel)) unavailable(reel); }, 12000);
      reel.player.playVideo();
    } else {
      reel.video.muted = true;
      reel.video.defaultMuted = true;
      if (!reel.video.getAttribute('src')) { reel.video.src = reel.video.dataset.src; reel.video.load(); }
      if (restart && reel.video.readyState > 0) reel.video.currentTime = 0;
      await reel.video.play();
      if (request !== requestId || !selected(reel)) {
        if (!selected(reel)) pause(reel);
        return;
      }
      reveal(reel);
    }
  } catch (error) {
    if (request === requestId && error.name !== 'AbortError') unavailable(reel);
  }
}
function select(index, userInitiated = false) {
  const reel = reels[index];
  if (!reel) return;
  const changed = index !== activeIndex;
  requestId++;
  activeIndex = index;
  if (userInitiated) explicitPlayback = true;
  showPoster();
  if (!reel.youtubeId && !reel.video.getAttribute('src')) {
    reel.video.src = reel.video.dataset.src;
    reel.video.load();
  }
  buttons.forEach(button => {
    const active = Number(button.dataset.reelIndex) === index;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (userInitiated) status.textContent = `배경 영상 ${index + 1} 선택: ${reel.title}`;
  play(changed || userInitiated);
}
buttons.forEach(button => button.addEventListener('click', () => select(Number(button.dataset.reelIndex), true)));
reels.forEach(reel => {
  reel.video.addEventListener('loadeddata', () => {
    if (!reel.youtubeId && reel === reels[activeIndex] && inView && !document.hidden) {
      reel.surface.classList.add('is-live');
      reel.surface.dataset.playback = 'ready';
    }
  });
  reel.video.addEventListener('playing', () => { if (!reel.youtubeId) reveal(reel); });
  reel.video.addEventListener('error', () => { if (!reel.youtubeId) unavailable(reel); });
});
new ResizeObserver(() => reels.forEach(sizePlayer)).observe(hero);
new IntersectionObserver(entries => {
  inView = entries[0].isIntersecting;
  if (inView) play();
  else { requestId++; pauseAll(); }
}, { threshold: 0 }).observe(hero);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { requestId++; pauseAll(); }
  else play();
});
motion.addEventListener('change', () => {
  explicitPlayback = false;
  requestId++;
  if (motion.matches) showPoster();
  else play();
});
window.addEventListener('pagehide', () => { requestId++; pauseAll(); });
window.addEventListener('pageshow', event => { if (event.persisted) play(); });
window.addEventListener('storage', event => { if (event.key === 'portfolio-content-updated') location.reload(); });

try {
  const response = await fetch('data/videos.json', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error('Video list unavailable');
  const store = await response.json();
  const availableWorkTypes = getWorkTypes(store);
  const videos = store.videos.filter(video => !video.deletedAt).flatMap(video => {
    try { return [normalizeVideo(video, availableWorkTypes)]; } catch { return []; }
  });
  reels.forEach(reel => {
    const video = videos.find(item => item.heroSlots.includes(reel.index + 1));
    if (!video) return;
    reel.title = video.title;
    if (video.type === 'youtube') {
      reel.youtubeId = video.youtubeId;
      reel.surface = document.createElement('div');
      reel.surface.className = 'hero__youtube';
      reel.surface.id = `hero-youtube-${reel.index + 1}`;
      reel.surface.setAttribute('aria-hidden', 'true');
      reel.surface.dataset.videoId = video.youtubeId;
      reel.video.after(reel.surface);
      buttons[reel.index].setAttribute('aria-controls', reel.surface.id);
    } else if (video.type === 'mp4') {
      reel.video.dataset.src = video.videoPath;
    }
  });
} catch { /* Keep the two local test reels when no saved assignment can be loaded. */ }
loaded = true;
select(activeIndex);
