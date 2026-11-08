import { normalizeProfile, renderCareers } from './profile-model.mjs';

const isLocal = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
const manager = document.querySelector('[data-profile-manager]');
if (isLocal && manager) manager.hidden = false;

let revision = -1;
const monthLabel = value => value ? `${Number(value.slice(0, 4))}` : '';
async function refreshProfile() {
  try {
    const base = location.pathname.includes('/projects/') ? '../' : '';
    const response = await fetch(`${base}data/profile.json`, { cache: 'no-store' });
    if (!response.ok) return;
    const store = await response.json();
    if (store.revision <= revision) return;
    const profile = normalizeProfile(store);
    const name = document.querySelector('#profile-name, #profile-title');
    const specialty = document.querySelector('.profile-specialty, .home-profile__specialty');
    if (name) name.textContent = profile.name;
    if (specialty) specialty.textContent = profile.specialty;

    const careerList = document.querySelector('[data-profile-careers]') || document.querySelector('.career-list');
    if (careerList) careerList.innerHTML = renderCareers(profile, location.pathname.includes('/projects/') ? '../' : '');
    revision = store.revision;
  } catch { /* Retain the static profile if the data file is unavailable. */ }
}
refreshProfile();
window.addEventListener('focus', refreshProfile);
window.addEventListener('storage', event => { if (event.key === 'portfolio-profile-updated') refreshProfile(); });
if ('BroadcastChannel' in window) {
  const updates = new BroadcastChannel('portfolio-profile');
  updates.addEventListener('message', refreshProfile);
}