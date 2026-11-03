const galleryTrack = document.querySelector('.study-gallery__track');
const gallerySlides = [...document.querySelectorAll('.study-gallery__slide')];
const previousSlide = document.querySelector('[data-gallery-previous]');
const nextSlide = document.querySelector('[data-gallery-next]');
const galleryCount = document.querySelector('[data-gallery-current]');
let galleryIndex = 0;
let galleryFrame = 0;

function updateGalleryState() {
  if (!galleryTrack || !gallerySlides.length) return;
  const center = galleryTrack.getBoundingClientRect().left + galleryTrack.clientWidth / 2;
  let nearest = 0;
  let distance = Infinity;
  gallerySlides.forEach((slide, index) => {
    const bounds = slide.getBoundingClientRect();
    const currentDistance = Math.abs(bounds.left + bounds.width / 2 - center);
    if (currentDistance < distance) {
      distance = currentDistance;
      nearest = index;
    }
  });
  galleryIndex = nearest;
  previousSlide.disabled = nearest === 0;
  nextSlide.disabled = nearest === gallerySlides.length - 1;
  galleryCount.textContent = String(nearest + 1).padStart(2, '0');
}

function moveGallery(direction) {
  const destination = Math.max(0, Math.min(gallerySlides.length - 1, galleryIndex + direction));
  const slide = gallerySlides[destination];
  const trackBounds = galleryTrack.getBoundingClientRect();
  const slideBounds = slide.getBoundingClientRect();
  galleryTrack.scrollTo({
    left: galleryTrack.scrollLeft + slideBounds.left - trackBounds.left - (galleryTrack.clientWidth - slideBounds.width) / 2,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

if (galleryTrack) {
  previousSlide.addEventListener('click', () => moveGallery(-1));
  nextSlide.addEventListener('click', () => moveGallery(1));
  galleryTrack.addEventListener('scroll', () => {
    cancelAnimationFrame(galleryFrame);
    galleryFrame = requestAnimationFrame(updateGalleryState);
  }, { passive: true });
  galleryTrack.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveGallery(event.key === 'ArrowLeft' ? -1 : 1);
  });
  window.addEventListener('resize', updateGalleryState);
  updateGalleryState();
}

const studyDialog = document.querySelector('#study-dialog');
const studyImage = document.querySelector('#study-dialog-image');
const studyTitle = document.querySelector('#study-dialog-title');
let studyTrigger = null;

document.querySelectorAll('[data-study-image]').forEach((button) => {
  button.addEventListener('click', () => {
    studyTrigger = button;
    studyImage.src = button.dataset.studyImage;
    studyImage.alt = button.dataset.studyAlt;
    studyTitle.textContent = button.dataset.studyTitle;
    studyDialog.showModal();
  });
});

if (studyDialog) {
  document.querySelector('[data-close-study]').addEventListener('click', () => studyDialog.close());
  studyDialog.addEventListener('click', (event) => {
    if (event.target !== studyDialog) return;
    const bounds = studyDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      studyDialog.close();
    }
  });
  studyDialog.addEventListener('close', () => studyTrigger?.focus({ preventScroll: true }));
}
