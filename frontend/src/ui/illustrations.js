import { POTS, SPECIES } from '@game/content.js';

function bearPawArt(style, rare) {
  const leaf = rare ? style.rare : style.leaf;
  const paws = [[62, 62, -43], [94, 60, 39], [70, 45, -24], [93, 43, 29], [80, 35, 0], [56, 77, -54], [103, 75, 53]];
  return `<path d="M80 95 80 52M80 87 59 72M80 84 101 69M80 69 67 50M80 67 94 48" fill="none" stroke="${leaf}" stroke-width="3.5"/>${paws.map(([x, y, angle]) =>
    `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M0 12C-10 11-13 1-10-6q0-4 3-3l2 3 1-5q2-4 4-1l1 4 2-5q3-2 4 2l1 4q4-3 4 1c3 7-1 17-12 18Z" fill="${leaf}"/><path d="m-9-8 1 2m4-6 1 2m6-3 1 2m6 2 1 2" stroke="${style.petal}" stroke-width="2" stroke-linecap="round"/><ellipse cx="-3" cy="2" rx="4" ry="6" fill="${style.center}" opacity=".43"/></g>`).join('')}`;
}

function rosetteArt(style, rare) {
  const pointed = style.model === 'haworthia';
  const leaves = [[60, 78, -49, .91], [100, 78, 49, .91], [64, 64, -31, .86], [96, 64, 31, .86], [80, 58, 0, .95],
    [68, 77, -21, .82], [92, 77, 21, .83], [80, 72, 0, .75], [57, 87, -65, .69], [103, 87, 65, .69], [80, 88, 8, .63]];
  return leaves.map(([x, y, angle, scale], i) => {
    const color = rare ? style.rare : i % 4 === 0 ? style.leaf : style.petal;
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${pointed
      ? `<path d="M0 19C-17 15-17 3 0-23 16-9 19 14 0 19Z" fill="${color}" stroke="${style.leaf}" stroke-width="1.2"/><path d="M0 12V-16M-4 8q-5-11-2-19M5 9q4-9 2-17" fill="none" stroke="#fff9e9" stroke-width="1.1" opacity=".75"/>`
      : `<ellipse rx="12" ry="21" fill="${color}" stroke="${style.leaf}" stroke-width=".85"/><ellipse cx="-2.8" cy="-6" rx="6.6" ry="12" fill="${style.center}" opacity=".72"/>`}</g>`;
  }).join('');
}

const succulentArt = new Map([['bear-paw', bearPawArt], ['haworthia', rosetteArt], ['peach-egg', rosetteArt]]);

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
  const top = mode === 'pot' ? '' : `<g>${succulentArt.get(style.model)?.(style, specimen.rare) ?? stems + foliage + flowers}</g>`;
  const bottom = mode === 'seed' ? '' : potArt;
  const viewBox = mode === 'pot' ? '36 82 88 66' : mode === 'seed' ? '30 16 100 83' : '24 8 112 137';
  return `<svg class="plant-art" viewBox="${viewBox}" aria-hidden="true">${top}${bottom}</svg>`;
}
