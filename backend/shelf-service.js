import { ApiError, uuidPattern } from './errors.js';

const visible = "g.visibility IN ('unlisted','public')";
const visitQuery = `SELECT g.id,p.display_name,g.player_id=$2 AS own,
    EXISTS (SELECT 1 FROM windowsill.shelf_likes l WHERE l.garden_id=g.id AND l.visitor_id=$2) AS liked,
    windowsill.read_shared_shelf(g.share_token) AS shelf
  FROM windowsill.gardens g JOIN windowsill.players p ON p.id=g.player_id
  WHERE g.share_token=$1 AND ${visible}`;

function visitData(row, token) {
  return { id: row.id, token, name: row.shelf.title, author: row.display_name, own: Boolean(row.own),
    liked: row.liked, likes: Number(row.shelf.likes), plants: row.shelf.plants };
}

export function createShelfService(database) {
  return {
    async publicList() {
      const { rows } = await database.query(`SELECT g.id,g.share_token,p.display_name,false AS own,false AS liked,
          windowsill.read_shared_shelf(g.share_token) AS shelf
        FROM windowsill.gardens g JOIN windowsill.players p ON p.id=g.player_id
        WHERE g.visibility='public' ORDER BY g.published_at DESC,g.id DESC LIMIT 24`);
      return rows.map((row) => visitData(row, row.share_token));
    },
    async get(token, player) {
      if (!uuidPattern.test(token)) throw new ApiError(404, '这张花架名片已失效。');
      const { rows: [row] } = await database.query(visitQuery, [token, player]);
      if (!row) throw new ApiError(404, '这张花架名片已失效。');
      return visitData(row, token);
    },
    async like(token, player, liked) {
      if (!uuidPattern.test(token)) throw new ApiError(404, '这张花架名片已失效。');
      return database.transaction(async (tx) => {
        const { rows: [garden] } = await tx.query(`SELECT id,player_id FROM windowsill.gardens g
          WHERE share_token=$1 AND ${visible} FOR SHARE`, [token]);
        if (!garden) throw new ApiError(404, '这张花架名片已失效。');
        if (garden.player_id === player) throw new ApiError(403, '不能喜欢自己的花架。');
        if (liked) await tx.query(`INSERT INTO windowsill.shelf_likes (garden_id,garden_owner_id,visitor_id)
          VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [garden.id, garden.player_id, player]);
        else await tx.query('DELETE FROM windowsill.shelf_likes WHERE garden_id=$1 AND visitor_id=$2', [garden.id, player]);
        const { rows: [row] } = await tx.query(visitQuery, [token, player]);
        return visitData(row, token);
      });
    },
  };
}
