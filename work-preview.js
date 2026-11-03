(() => {
  const cards = [...document.querySelectorAll('[data-preview-video]')];
  if (!cards.length) return;

  const hoverInput = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let apiPromise;
  let activePreview;

  function loadYouTubeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('YouTube preview unavailable')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        resolve(window.YT);
      };
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('YouTube preview unavailable'));
      };
      document.head.append(script);
    });
    return apiPromise;
  }

  const previews = cards.map((card) => {
    const frame = card.querySelector('.work-study__image');
    const mount = card.querySelector('[data-preview-mount]');
    let player;
    let preparation;
    let ready = false;
    let wanted = false;
    let visible = false;
    let disposed = false;
    let playbackTimeout;

    const eligible = () => !disposed && visible && !document.hidden && hoverInput.matches &&
      !reducedMotion.matches && frame.getBoundingClientRect().height >= 200;

    function stop() {
      if (disposed) return;
      wanted = false;
      clearTimeout(playbackTimeout);
      card.dataset.previewState = 'idle';
      if (ready) player.pauseVideo();
      if (activePreview === preview) activePreview = undefined;
    }

    function unavailable() {
      if (disposed) return;
      stop();
      card.dataset.previewState = 'unavailable';
    }

    function play() {
      if (!ready || !wanted || !eligible()) return;
      // Mute before requesting playback: a hover is not an audio permission gesture.
      player.mute();
      player.seekTo(0, true);
      player.playVideo();
    }

    function prepare() {
      if (preparation || !eligible()) return preparation;
      preparation = loadYouTubeAPI().then((YT) => {
        if (disposed) return;
        player = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          videoId: card.dataset.previewVideo,
          playerVars: {
            autoplay: 0, controls: 0, disablekb: 1, fs: 0,
            playsinline: 1, rel: 0, origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) { event.target.destroy(); return; }
              player = event.target;
              ready = true;
              const iframe = player.getIframe();
              iframe.title = `${card.dataset.previewTitle || 'Video'} muted preview`;
              iframe.tabIndex = -1;
              iframe.setAttribute('aria-hidden', 'true');
              iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
              iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              player.mute();
              if (wanted && eligible()) play();
              else stop();
            },
            onStateChange: (event) => {
              if (disposed) return;
              if (event.data === YT.PlayerState.PLAYING) {
                if (!wanted || !eligible()) { stop(); return; }
                clearTimeout(playbackTimeout);
                card.dataset.previewState = 'playing';
              } else if (event.data === YT.PlayerState.ENDED && wanted && eligible()) {
                play();
              }
            },
            onAutoplayBlocked: unavailable,
            onError: unavailable,
          },
        });
      }).catch(unavailable);
      return preparation;
    }

    function start() {
      if (!eligible()) return;
      if (activePreview && activePreview !== preview) activePreview.stop();
      activePreview = preview;
      wanted = true;
      card.dataset.previewState = 'loading';
      clearTimeout(playbackTimeout);
      playbackTimeout = setTimeout(unavailable, 12000);
      if (ready) play();
      else prepare();
    }

    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') start();
    });
    card.addEventListener('focus', () => {
      if (card.matches(':focus-visible')) start();
    });
    ['pointerleave', 'pointercancel', 'blur', 'click'].forEach((type) => card.addEventListener(type, stop));

    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].intersectionRatio >= 0.5;
      if (visible) prepare();
      else stop();
    }, { threshold: [0, 0.5] });
    observer.observe(card);

    const preview = {
      stop,
      dispose() {
        stop();
        disposed = true;
        observer.disconnect();
        player?.destroy();
      },
    };
    return preview;
  });

  const stopAll = () => previews.forEach((preview) => preview.stop());
  document.addEventListener('portfolio-works-filtered', stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  window.addEventListener('blur', stopAll);
  window.addEventListener('pagehide', (event) => {
    // Keep reusable players intact when the page enters the back/forward cache.
    if (event.persisted) stopAll();
    else previews.forEach((preview) => preview.dispose());
  });
  hoverInput.addEventListener('change', stopAll);
  reducedMotion.addEventListener('change', stopAll);
  window.addEventListener('resize', stopAll);
})();
