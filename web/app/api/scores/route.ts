import { ensureScoreSchema, getDatabase } from "@/db";

export const dynamic = "force-dynamic";

type ScoreRow = {
  id: number;
  playerId: string;
  playerName: string;
  score: number;
  mode: string;
  skin: string;
  durationSeconds: number;
  playedAt: string;
};

function normalizeRows(rows: ScoreRow[]) {
  return rows.map((row) => ({
    id: row.id,
    playerId: row.playerId,
    playerName: row.playerName,
    score: row.score,
    mode: row.mode,
    skin: row.skin,
    durationSeconds: row.durationSeconds,
    playedAt: row.playedAt,
  }));
}

export async function GET(request: Request) {
  try {
    await ensureScoreSchema();
    const database = getDatabase();
    const playerId = new URL(request.url).searchParams.get("playerId")?.trim();

    const [leaderboardResult, historyResult] = await Promise.all([
      database
        .prepare(`
          SELECT
            id,
            player_id AS playerId,
            player_name AS playerName,
            score,
            mode,
            skin,
            duration_seconds AS durationSeconds,
            played_at AS playedAt
          FROM scores
          ORDER BY score DESC, played_at ASC
          LIMIT 10
        `)
        .all<ScoreRow>(),
      playerId
        ? database
            .prepare(`
              SELECT
                id,
                player_id AS playerId,
                player_name AS playerName,
                score,
                mode,
                skin,
                duration_seconds AS durationSeconds,
                played_at AS playedAt
              FROM scores
              WHERE player_id = ?
              ORDER BY played_at DESC, id DESC
              LIMIT 20
            `)
            .bind(playerId)
            .all<ScoreRow>()
        : Promise.resolve({ results: [] as ScoreRow[] }),
    ]);

    return Response.json({
      leaderboard: normalizeRows(leaderboardResult.results),
      history: normalizeRows(historyResult.results),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      playerId?: string;
      playerName?: string;
      score?: number;
      mode?: string;
      skin?: string;
      durationSeconds?: number;
    };
    const playerId = payload.playerId?.trim() ?? "";
    const playerName = payload.playerName?.trim().slice(0, 16) ?? "";
    const score = Number(payload.score);
    const durationSeconds = Number(payload.durationSeconds);
    const mode = payload.mode === "obstacle" ? "obstacle" : "classic";
    const skin = payload.skin?.trim().slice(0, 24) || "acid";

    if (!playerId || playerId.length > 64) {
      return Response.json({ error: "Invalid player id" }, { status: 400 });
    }
    if (!playerName) {
      return Response.json({ error: "Player name is required" }, { status: 400 });
    }
    if (!Number.isInteger(score) || score < 0 || score > 100_000) {
      return Response.json({ error: "Invalid score" }, { status: 400 });
    }
    if (
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 0 ||
      durationSeconds > 3_600
    ) {
      return Response.json({ error: "Invalid run duration" }, { status: 400 });
    }

    await ensureScoreSchema();
    await getDatabase()
      .prepare(`
        INSERT INTO scores (
          player_id,
          player_name,
          score,
          mode,
          skin,
          duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(playerId, playerName, score, mode, skin, durationSeconds)
      .run();

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
