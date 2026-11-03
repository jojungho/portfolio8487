import { normalizeProfile, renderCareers } from './profile-model.mjs';

if (['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
  document.querySelector('[data-profile-manager]').hidden = false;
}
let revision = -1;
async function refreshProfile() {
  try {
    const response = await fetch('../data/profile.json', { cache: 'no-store' });
    if (!response.ok) return;
    const store = await response.json();
    if (store.revision <= revision) return;
    const profile = normalizeProfile(store);
    document.querySelector('#profile-name').textContent = profile.name;
    document.querySelector('.profile-specialty').textContent = profile.specialty;
    document.querySelector('.career-list').innerHTML = renderCareers(profile);
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
