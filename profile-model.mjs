const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, label, max = 200, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label}을(를) 확인해주세요.`);
  return value.trim();
};
const id = value => {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,80}$/.test(value)) fail('항목 ID가 올바르지 않습니다.');
  return value;
};
const unique = items => {
  if (new Set(items.map(item => item.id)).size !== items.length) fail('중복 항목이 있습니다.');
  return items;
};
const month = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function normalizeProfile(input) {
  if (!input || !Array.isArray(input.careers) || input.careers.length > 40) fail('경력 목록을 확인해주세요.');
  return {
    version: 1,
    name: text(input.name, '이름', 100, true),
    specialty: text(input.specialty, '전문 분야', 200),
    careers: unique(input.careers.map(career => {
      if (!career || !month(career.start) || typeof career.current !== 'boolean' || (!career.current && (!month(career.end) || career.end < career.start))) fail('입사·퇴사 기간을 확인해주세요.');
      if (!['video', 'poster'].includes(career.layout)) fail('이미지 배치를 확인해주세요.');
      if (!Array.isArray(career.projects) || career.projects.length > 30 || !Array.isArray(career.images) || career.images.length > 100) fail('작업 목록이 너무 깁니다.');
      return {
        id: id(career.id), company: text(career.company, '회사명', 150, true),
        location: text(career.location, '지역', 100), team: text(career.team, '부서', 200),
        start: career.start, end: career.current ? '' : career.end, current: career.current,
        role: text(career.role, '담당 분야', 200), position: text(career.position, '직책', 150),
        projects: career.projects.map(value => text(value, '업무 내용', 1000)).filter(Boolean),
        layout: career.layout,
        images: unique(career.images.map(image => {
          if (!image || typeof image.src !== 'string' || !/^assets\/profile\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(image.src)) fail('이미지 경로가 올바르지 않습니다.');
          if (![image.width, image.height].every(n => Number.isInteger(n) && n > 0 && n <= 20000)) fail('이미지 크기를 확인해주세요.');
          return { id: id(image.id), src: image.src, title: text(image.title, '이미지 타이틀', 200, true), alt: text(image.alt || image.title, '이미지 설명', 500), width: image.width, height: image.height };
        })),
      };
    })),
  };
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dateLabel = value => `${Number(value.slice(0, 4))}년 ${Number(value.slice(5))}월`;
export function renderCareers(profile) {
  const e = escapeHTML;
  return profile.careers.map(career => `<li class="career-entry${career.current ? ' career-entry--current' : ''}">
    <article aria-labelledby="${e(career.id)}-title">
      <div class="career-entry__top"><h2 id="${e(career.id)}-title">${e(career.company)}${career.location ? ` <span class="career-location">${e(career.location)}</span>` : ''}</h2>${career.current ? '<span class="career-current"><span aria-hidden="true"></span>현재 재직</span>' : ''}</div>
      ${career.team ? `<p class="career-team">${e(career.team)}</p>` : ''}
      <p class="career-date"><time datetime="${career.start}">${dateLabel(career.start)}</time><span aria-hidden="true">—</span>${career.current ? '<span>현재</span>' : `<time datetime="${career.end}">${dateLabel(career.end)}</time>`}</p>
      <p class="career-role">${e(career.role)} <span>${e(career.position)}</span></p>
      <ul class="career-projects" aria-label="${e(career.company)} 주요 작업">${career.projects.map(project => `<li>${e(project)}</li>`).join('')}</ul>
      <div class="career-gallery${career.layout === 'video' ? ' career-gallery--video' : ''}" role="group" aria-label="${e(career.company)} 작품 이미지">
        ${career.images.map(image => `<figure class="career-poster career-poster--work" style="--poster-ratio: ${image.width / image.height}" tabindex="0" aria-label="${e(image.title)} 이미지"><img src="../${e(image.src)}" alt="${e(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async" /><figcaption class="career-poster__caption" aria-hidden="true">${e(image.title)}</figcaption></figure>`).join('\n')}
      </div>
    </article>
  </li>`).join('\n');
}
export function renderProfilePage(html, profile) {
  return html.replace(/(<h1 id="profile-name">)[\s\S]*?(<\/h1>)/, (_, open, close) => open + escapeHTML(profile.name) + close)
    .replace(/(<p class="profile-specialty">)[\s\S]*?(<\/p>)/, (_, open, close) => open + escapeHTML(profile.specialty) + close)
    .replace(/(<ol class="career-list">)[\s\S]*?(<\/ol>)/, (_, open, close) => open + '\n' + renderCareers(profile) + '\n' + close);
}
