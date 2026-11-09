import { openDatabase, migrate } from './database.js';
import { createAuthService } from './auth-service.js';
import { createGameService } from './game-service.js';
import { createShelfService } from './shelf-service.js';
import { createApi } from './http.js';
import { currentRelease } from '../shared/releases.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.DATABASE_URL) throw new Error('生产环境需要 DATABASE_URL');
const database = await openDatabase();
try {
  if (process.env.NODE_ENV !== 'production' || process.argv.includes('--migrate')) await migrate(database);
  if (process.argv.includes('--migrate')) {
    console.log('窗边小事数据库迁移完成');
    await database.close();
  } else {
    await database.query('SELECT token_digest FROM windowsill.account_sessions LIMIT 0');
    const { rows } = await database.query('SELECT version FROM windowsill.content_releases WHERE version=$1', [currentRelease.version]);
    if (!rows.length) throw new Error('内容目录尚未迁移，请先运行 npm run db:migrate。');
    const fastForward = !production && process.env.PLANT_FAST_FORWARD !== '0';
    const port = Number(process.env.PLANT_API_PORT ?? 3001);
    const host = process.env.PLANT_API_HOST ?? '127.0.0.1';
    const localOrigins = ['localhost', '127.0.0.1'].flatMap((name) => [5173, 4173].map((frontPort) => `http://${name}:${frontPort}`));
    const origins = new Set((process.env.PLANT_FRONTEND_ORIGINS ?? (production ? '' : localOrigins.join(','))).split(',').map((value) => value.trim()).filter(Boolean));
    const server = createApi({ auth: createAuthService(database), games: createGameService(database, { fastForward }),
      shelves: createShelfService(database), origins, secureCookie: production,
      trustLoopbackProxy: process.env.PLANT_TRUST_LOOPBACK_PROXY === '1' });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
    console.log(`花园 API http://${host}:${port}/api · ${process.env.DATABASE_URL ? 'PostgreSQL' : '本地 PGlite'}`);
    let stopping = false;
    function shutdown() {
      if (stopping) return;
      stopping = true;
      server.close(async () => {
        try {
          await database.close();
        } catch (error) {
          console.error('关闭数据库失败：', error.message);
          process.exitCode = 1;
        }
      });
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
} catch (error) {
  await database.close();
  throw error;
}
