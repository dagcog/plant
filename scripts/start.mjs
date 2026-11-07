import { spawn } from 'node:child_process';

const preview = process.argv.includes('--preview');
const port = Number(process.env.PLANT_PORT ?? (preview ? 4173 : 5173));
const localOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
const env = { ...process.env, PLANT_FRONTEND_ORIGINS: process.env.PLANT_FRONTEND_ORIGINS ?? localOrigins.join(',') };
const processes = [
  spawn(process.execPath, ['backend/start.js'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['scripts/serve.mjs', ...(preview ? ['--dist'] : [])], { stdio: 'inherit', env }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const process of processes) if (process.exitCode === null) process.kill();
  process.exitCode = code;
}
for (const child of processes) {
  child.on('exit', (code) => stop(code ?? 1));
  child.on('error', (error) => { console.error(error); stop(1); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
