import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeProfile, renderProfilePage } from '../profile-model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = join(root, 'exports', `portfolio-${stamp}`);
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'script.js', 'hero-reels.js', 'project.css', 'project.js', 'profile.css', 'profile-content.js', 'profile-model.mjs', 'work-detail.css', 'work-preview.js', 'portfolio-content.js', 'content-model.mjs']) {
  await copyFile(join(root, file), join(output, file));
}
async function copyPublicTree(relative) {
  await mkdir(join(output, relative), { recursive: true });
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const child = join(relative, entry.name);
    if (entry.isDirectory()) await copyPublicTree(child);
    else if (/\.(html|png|jpe?g|webp|svg|mp4|webm|ico|woff2?)$/i.test(entry.name)) await copyFile(join(root, child), join(output, child));
  }
}
await copyPublicTree('projects');
await copyPublicTree('assets');
const store = JSON.parse(await readFile(join(root, 'data', 'videos.json'), 'utf8'));
store.videos = store.videos.filter(video => !video.deletedAt);
await mkdir(join(output, 'data'));
await writeFile(join(output, 'data', 'videos.json'), JSON.stringify(store, null, 2));
const profileStore = JSON.parse(await readFile(join(root, 'data', 'profile.json'), 'utf8'));
const profile = normalizeProfile(profileStore);
await writeFile(join(output, 'data', 'profile.json'), JSON.stringify({ ...profile, revision: profileStore.revision }, null, 2));
const profilePage = join(output, 'projects', 'cloth-simulation.html');
await writeFile(profilePage, renderProfilePage(await readFile(profilePage, 'utf8'), profile));
console.log(`Public site files: ${output}`);
console.log('Admin screens, local server, backups and deleted videos are excluded. Nothing was uploaded.');
