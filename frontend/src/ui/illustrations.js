import { POTS, SPECIES } from '@game/content.js';

export function plantArt(specimen, mode = 'both') {
  const style = SPECIES[specimen.species];
  const pot = POTS[specimen.pot];
  const petal = specimen.rare ? style.rare : style.petal;
  const leaves = specimen.rare && style.model === 'clover' ? '#be8752' : style.leaf;
  const potArt = `<ellipse cx="80" cy="137" rx="39" ry="5" fill="#827158" opacity=".14"/><path d="M50 97h60l-7 32q-2 7-11 8H68q-9-1-11-8Z" fill="${pot.color}"/><path d="M61 104l5 25q1 4 6 4h6l-3-29Z" fill="${pot.rim}" opacity=".5"/><rect x="47" y="92" width="66" height="13" rx="5" fill="${pot.rim}"/><ellipse cx="80" cy="95" rx="27" ry="3.6" fill="#72533f"/>`;
  const blossoms = [[48, 56, 11], [72, 35, 13], [98, 48, 11], [112, 66, 8], [60, 74, 8]];
  const stems = blossoms.map(([x, y]) => `<path d="M80 96Q${(x + 81) / 2} ${y + 21} ${x} ${y}" fill="none" stroke="${leaves}" stroke-width="2.2" stroke-linecap="round"/>`).join('');
  const foliage = `<path d="M78 90Q55 92 43 77q23-7 35 13Zm4 1q14-21 34-16-11 16-34 16ZM76 78Q60 75 55 61q16 1 21 17Zm9 3q2-18 18-23-2 16-18 23Z" fill="${leaves}"/>`;
  const flowers = blossoms.map(([x, y, radius], i) => {
    if (style.model === 'spike') return `<g transform="translate(${x} ${y}) rotate(${(i - 2) * 7})">${Array.from({ length: 5 }, (_, n) => `<ellipse cx="${n % 2 ? 3 : -3}" cy="${n * -4}" rx="${5.5 - n * 0.43}" ry="3.2" fill="${n % 2 ? petal : style.center}"/>`).join('')}</g>`;
    if (style.model === 'clover') return `<g transform="translate(${x} ${y}) scale(${radius / 12})"><path d="M0 3C-14-2-12-13-5-11-1-14 3-10 3-6 7-10 15-6 13-2 14 4 6 6 2 5 2 12-9 13-9 7-9 4-4 2 0 3Z" fill="${leaves}"/><circle cx="-7" cy="-9" r="2.4" fill="${petal}"/></g>`;
    return `<g transform="translate(${x} ${y}) scale(${radius / 12})">${Array.from({ length: 8 }, (_, n) => `<ellipse cy="-7.5" rx="3.1" ry="6" transform="rotate(${n * 45})" fill="${petal}"/>`).join('')}<circle r="4.2" fill="${style.center}"/></g>`;
  }).join('');
  const top = mode === 'pot' ? '' : `<g>${stems}${foliage}${flowers}</g>`;
  const bottom = mode === 'seed' ? '' : potArt;
  const viewBox = mode === 'pot' ? '36 82 88 66' : mode === 'seed' ? '30 16 100 83' : '24 8 112 137';
  return `<svg class="plant-art" viewBox="${viewBox}" aria-hidden="true">${top}${bottom}</svg>`;
}
