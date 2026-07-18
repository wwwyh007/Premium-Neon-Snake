import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scores = sqliteTable(
  "scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: text("player_id").notNull(),
    playerName: text("player_name").notNull(),
    score: integer("score").notNull(),
    mode: text("mode").notNull(),
    skin: text("skin").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    playedAt: text("played_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("scores_rank_idx").on(table.score, table.playedAt),
    index("scores_player_idx").on(table.playerId, table.playedAt),
  ],
);
