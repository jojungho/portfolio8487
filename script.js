const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const activeId = entry.target.id;
    document.querySelectorAll('.section-step').forEach((step) => {
      const active = step.dataset.step === activeId;
      step.classList.toggle('is-active', active);
      if (active) step.setAttribute('aria-current', 'location');
      else step.removeAttribute('aria-current');
    });
  }
}, { threshold: 0.55 });

document.querySelectorAll('.page-section').forEach((section) => sectionObserver.observe(section));

// Keep the card's reference area stable while its visual surface rotates.
const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const resetCardTilts = [];

document.querySelectorAll('.project-card').forEach((card) => {
  let reference = null;
  let frame = 0;
  let tilt = 0;

  function resetTilt() {
    cancelAnimationFrame(frame);
    frame = 0;
    reference = null;
    card.classList.remove('is-tilting');
    card.style.removeProperty('--card-tilt-y');
  }

  function followPointer(event) {
    if (event.pointerType !== 'mouse' || !hoverPointer.matches || reducedMotion.matches) return;
    if (!reference) {
      const bounds = card.getBoundingClientRect();
      reference = { center: bounds.left + bounds.width / 2, halfWidth: card.offsetWidth / 2 };
      card.classList.add('is-tilting');
    }

    const position = Math.max(-1, Math.min(1, (event.clientX - reference.center) / reference.halfWidth));
    tilt = position * 15;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      card.style.setProperty('--card-tilt-y', `${tilt.toFixed(2)}deg`);
      frame = 0;
    });
  }

  card.addEventListener('pointerenter', followPointer);
  card.addEventListener('pointermove', followPointer);
  card.addEventListener('pointerleave', resetTilt);
  card.addEventListener('pointercancel', resetTilt);
  resetCardTilts.push(resetTilt);
});

function resetAllCardTilts() {
  resetCardTilts.forEach((reset) => reset());
}

window.addEventListener('resize', resetAllCardTilts);
window.addEventListener('scroll', resetAllCardTilts, { capture: true, passive: true });
window.addEventListener('blur', resetAllCardTilts);
hoverPointer.addEventListener('change', resetAllCardTilts);
reducedMotion.addEventListener('change', resetAllCardTilts);

