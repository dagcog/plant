import * as T from 'three';
import { seeded } from '@game/simulation.js';

const palettes = {
  morning: ['#a2b8ad', '#f7eac1', '#fff3bc', '#a8ad82', '#8d9b69', '#718b59', '#577249', '#cad08e'],
  noon: ['#8cb3be', '#eaf3d5', '#fff4b4', '#afbe96', '#96aa77', '#739663', '#577d50', '#d3dc9b'],
  evening: ['#787e9f', '#f2ba9b', '#ffe0a1', '#ab8d9a', '#958185', '#777877', '#52665e', '#c2ad83'],
};

export function landscape(phase) {
  const [sky, horizon, sun, ...greens] = palettes[phase];
  const canvas = document.createElement('canvas');
  canvas.width = 1152;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  const { width, height } = canvas;
  const gradient = context.createLinearGradient(0, 0, 0, 430);
  gradient.addColorStop(0, sky);
  gradient.addColorStop(1, horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const [sx, sy] = { morning: [235, 205], noon: [460, 65], evening: [925, 295] }[phase];
  const glow = context.createRadialGradient(sx, sy, 8, sx, sy, 170);
  glow.addColorStop(0, sun);
  glow.addColorStop(0.25, `${sun}bb`);
  glow.addColorStop(1, `${sun}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.fillStyle = sun;
  context.beginPath();
  context.arc(sx, sy, 29, 0, Math.PI * 2);
  context.fill();

  for (let i = 0; i < 30; i++) {
    const x = seeded(i, 20) * width;
    const y = 28 + seeded(i, 38) * 260;
    const w = 44 + seeded(i, 61) * 137;
    context.fillStyle = i % 4 === 0 ? '#fff9df43' : '#fff9df24';
    context.beginPath();
    context.ellipse(x, y, w, 2 + seeded(i, 42) * 8, 0.018, 0, Math.PI * 2);
    context.fill();
  }

  function ridge(i, x) {
    return 309 + i * 47 + Math.sin(x * (0.004 + i * 0.0007) + i * 2.5) * (36 + i * 6) + Math.cos(x * 0.011 - i) * 15;
  }
  for (let i = 0; i < 4; i++) {
    context.fillStyle = greens[i];
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width; x += 8) context.lineTo(x, ridge(i, x));
    context.lineTo(width, height);
    context.fill();
    for (let j = 0; j < 280; j++) {
      const x = seeded(j, i * 715 + 2) * width;
      const y = ridge(i, x) + seeded(j, i * 621 + 81) * 112;
      const radius = (0.3 + seeded(j, i * 523 + 7)) * (3 + i * 1.4);
      context.fillStyle = j % 3 === 0 ? `${greens[4]}50` : '#273d3338';
      context.beginPath();
      context.ellipse(x, y, radius * 1.9, radius, -0.16, 0, Math.PI * 2);
      context.fill();
    }
  }

  for (let i = 0; i < 75; i++) {
    const left = i < 42;
    const x = left ? seeded(i, 60) * 240 - 50 : width - 235 + seeded(i, 57) * 285;
    const y = 482 + seeded(i, 29) * 141 - Math.abs(x - width * 0.5) * 0.24;
    const r = 10 + seeded(i, 91) * 34;
    context.fillStyle = [`${greens[2]}ab`, `${greens[3]}ae`, `${greens[4]}65`][i % 3];
    context.beginPath();
    context.ellipse(x, y, r, r * 0.59, seeded(i) * 3, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = 0; i < 15500; i++) {
    context.fillStyle = i % 2 ? '#ffffee16' : '#32282912';
    context.fillRect(seeded(i, 916) * width, seeded(i, 414) * height, 1.7, 1.4);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
