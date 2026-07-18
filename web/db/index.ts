import { env } from "cloudflare:workers";

let schemaReady: Promise<void> | null = null;

export function getDatabase(): D1Database {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return env.DB;
}

export async function ensureScoreSchema(): Promise<void> {
  if (schemaReady) {
    return schemaReady;
  }

  const database = getDatabase();
  schemaReady = database
    .batch([
      database.prepare(`
        CREATE TABLE IF NOT EXISTS scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT NOT NULL,
          player_name TEXT NOT NULL,
          score INTEGER NOT NULL,
          mode TEXT NOT NULL,
          skin TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS scores_rank_idx
        ON scores (score DESC, played_at DESC)
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS scores_player_idx
        ON scores (player_id, played_at DESC)
      `),
    ])
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });

  return schemaReady;
}
