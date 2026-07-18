"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  START_SECONDS,
  createGame,
  type Direction,
  type GameMode,
  type GameModel,
  queueDirection,
  setPhase,
  stepGame,
  tickTimer,
} from "./game-engine";

const CANVAS_WIDTH = 768;
const CANVAS_HEIGHT = 576;
const CELL_WIDTH = CANVAS_WIDTH / BOARD_COLUMNS;
const CELL_HEIGHT = CANVAS_HEIGHT / BOARD_ROWS;
const MOVE_INTERVAL_MS = 96;
const PLAYER_ID_KEY = "premium-neon-snake:player-id";
const PLAYER_NAME_KEY = "premium-neon-snake:player-name";
const SKIN_KEY = "premium-neon-snake:skin";

type SnakeSkin = {
  id: string;
  label: string;
  headHue: number;
  tailHue: number;
  saturation: number;
  lightness: number;
  swatch: string;
};

type ScoreRecord = {
  id: number;
  playerId: string;
  playerName: string;
  score: number;
  mode: GameMode;
  skin: string;
  durationSeconds: number;
  playedAt: string;
};

const SKINS: readonly SnakeSkin[] = [
  {
    id: "acid",
    label: "Acid",
    headHue: 150,
    tailHue: 190,
    saturation: 96,
    lightness: 58,
    swatch: "linear-gradient(135deg, #47ff97, #4fe5ff)",
  },
  {
    id: "plasma",
    label: "Plasma",
    headHue: 315,
    tailHue: 265,
    saturation: 96,
    lightness: 64,
    swatch: "linear-gradient(135deg, #ff4fd8, #8b5cff)",
  },
  {
    id: "solar",
    label: "Solar",
    headHue: 48,
    tailHue: 10,
    saturation: 98,
    lightness: 60,
    swatch: "linear-gradient(135deg, #fff05a, #ff5d38)",
  },
  {
    id: "arctic",
    label: "Arctic",
    headHue: 185,
    tailHue: 225,
    saturation: 98,
    lightness: 66,
    swatch: "linear-gradient(135deg, #76fff2, #4d79ff)",
  },
  {
    id: "random",
    label: "Random",
    headHue: 0,
    tailHue: 0,
    saturation: 96,
    lightness: 62,
    swatch:
      "conic-gradient(from 45deg, #ff4f7b, #ffe85a, #47ff97, #4fe5ff, #9b5cff, #ff4f7b)",
  },
] as const;

const KEYS: Record<string, Direction> = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  D: { x: 1, y: 0 },
};

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.ceil(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function formatRunDate(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createPlayerName(id: string): string {
  return `NEON-${id.replaceAll("-", "").slice(0, 4).toUpperCase()}`;
}

function resolveSkin(id: string): SnakeSkin {
  const selected = SKINS.find((skin) => skin.id === id) ?? SKINS[0];
  if (selected.id !== "random") {
    return selected;
  }
  const headHue = Math.floor(Math.random() * 360);
  return {
    ...selected,
    headHue,
    tailHue: (headHue + 75) % 360,
  };
}

function drawGame(
  context: CanvasRenderingContext2D,
  game: GameModel,
  now: number,
  skin: SnakeSkin,
): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.35,
    20,
    width * 0.5,
    height * 0.45,
    width * 0.72,
  );
  background.addColorStop(0, "#17334d");
  background.addColorStop(0.48, "#0c1b2c");
  background.addColorStop(1, "#06101c");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const sweep = ((now / 14) % (height + 160)) - 80;
  const scanGlow = context.createLinearGradient(0, sweep - 70, 0, sweep + 70);
  scanGlow.addColorStop(0, "rgba(79, 229, 255, 0)");
  scanGlow.addColorStop(0.5, "rgba(79, 229, 255, 0.065)");
  scanGlow.addColorStop(1, "rgba(79, 229, 255, 0)");
  context.fillStyle = scanGlow;
  context.fillRect(0, sweep - 70, width, 140);

  context.save();
  context.strokeStyle = "rgba(104, 225, 255, 0.13)";
  context.lineWidth = 1;
  for (let x = 0; x <= BOARD_COLUMNS; x += 1) {
    context.beginPath();
    context.moveTo(x * CELL_WIDTH + 0.5, 0);
    context.lineTo(x * CELL_WIDTH + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= BOARD_ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y * CELL_HEIGHT + 0.5);
    context.lineTo(width, y * CELL_HEIGHT + 0.5);
    context.stroke();
  }
  context.restore();

  for (const obstacle of game.obstacles) {
    const x = obstacle.x * CELL_WIDTH + 3;
    const y = obstacle.y * CELL_HEIGHT + 3;
    context.save();
    context.shadowColor = "rgba(111, 196, 255, 0.75)";
    context.shadowBlur = 10;
    context.fillStyle = "#42637c";
    context.strokeStyle = "#9bdcff";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, CELL_WIDTH - 6, CELL_HEIGHT - 6, 5);
    context.fill();
    context.stroke();
    context.restore();
  }

  const pulse = 1 + Math.sin(now / 130) * 0.14;
  const foodX = (game.food.position.x + 0.5) * CELL_WIDTH;
  const foodY = (game.food.position.y + 0.5) * CELL_HEIGHT;
  const foodColor = game.food.kind === "special" ? "#ff496f" : "#ff42c6";
  context.save();
  context.shadowColor = foodColor;
  context.shadowBlur = game.food.kind === "special" ? 30 : 22;
  context.fillStyle = foodColor;
  context.beginPath();
  context.arc(foodX, foodY, 8 * pulse, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.72)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(foodX, foodY, 12 * pulse, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  [...game.snake].reverse().forEach((segment, reverseIndex) => {
    const index = game.snake.length - reverseIndex - 1;
    const progress = index / Math.max(1, game.snake.length - 1);
    const hue = skin.headHue + (skin.tailHue - skin.headHue) * progress;
    const x = segment.x * CELL_WIDTH + 2.5;
    const y = segment.y * CELL_HEIGHT + 2.5;
    const color = `hsl(${hue} ${skin.saturation}% ${skin.lightness - progress * 6}%)`;
    context.save();
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = index === 0 ? 26 : 8;
    context.beginPath();
    context.roundRect(x, y, CELL_WIDTH - 5, CELL_HEIGHT - 5, 7);
    context.fill();
    context.restore();
  });

  const head = game.snake[0];
  const headCenter = {
    x: (head.x + 0.5) * CELL_WIDTH,
    y: (head.y + 0.5) * CELL_HEIGHT,
  };
  const eyeShiftX = game.direction.x * 4;
  const eyeShiftY = game.direction.y * 4;
  const sideX = game.direction.y * 4;
  const sideY = -game.direction.x * 4;
  context.fillStyle = "#06120d";
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(
      headCenter.x + eyeShiftX + sideX * side,
      headCenter.y + eyeShiftY + sideY * side,
      2.2,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  const edgeGlow = context.createLinearGradient(0, 0, width, height);
  edgeGlow.addColorStop(0, "rgba(72, 229, 255, 0.82)");
  edgeGlow.addColorStop(0.5, "rgba(54, 255, 151, 0.24)");
  edgeGlow.addColorStop(1, "rgba(255, 62, 184, 0.72)");
  context.strokeStyle = edgeGlow;
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, width - 3, height - 3);
}

export function NeonSnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameModel>(createGame());
  const skinRef = useRef<SnakeSkin>(SKINS[0]);
  const runIdRef = useRef(0);
  const recordedRunRef = useRef(-1);
  const runStartedAtRef = useRef<number | null>(null);
  const [game, setGame] = useState<GameModel>(() => gameRef.current);
  const [skinChoice, setSkinChoice] = useState("acid");
  const [activeSkin, setActiveSkin] = useState<SnakeSkin>(SKINS[0]);
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [history, setHistory] = useState<ScoreRecord[]>([]);
  const [scoreView, setScoreView] = useState<"global" | "history">("global");
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoreError, setScoreError] = useState("");

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    skinRef.current = activeSkin;
  }, [activeSkin]);

  useEffect(() => {
    const storedId = window.localStorage.getItem(PLAYER_ID_KEY);
    const id = storedId || window.crypto.randomUUID();
    const name =
      window.localStorage.getItem(PLAYER_NAME_KEY) || createPlayerName(id);
    const storedSkin = window.localStorage.getItem(SKIN_KEY) || "acid";
    window.localStorage.setItem(PLAYER_ID_KEY, id);
    window.localStorage.setItem(PLAYER_NAME_KEY, name);
    setPlayerId(id);
    setPlayerName(name);
    setSkinChoice(storedSkin);
    setActiveSkin(resolveSkin(storedSkin));
  }, []);

  const loadScores = useCallback(async (id: string) => {
    setScoresLoading(true);
    try {
      const response = await fetch(`/api/scores?playerId=${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error("Score network unavailable");
      }
      const payload = (await response.json()) as {
        leaderboard?: ScoreRecord[];
        history?: ScoreRecord[];
      };
      setLeaderboard(payload.leaderboard ?? []);
      setHistory(payload.history ?? []);
      setScoreError("");
    } catch {
      setScoreError("Leaderboard is reconnecting…");
    } finally {
      setScoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (playerId) {
      void loadScores(playerId);
    }
  }, [loadScores, playerId]);

  useEffect(() => {
    if (
      game.phase !== "gameover" ||
      !playerId ||
      runStartedAtRef.current === null ||
      recordedRunRef.current === runIdRef.current
    ) {
      return;
    }

    recordedRunRef.current = runIdRef.current;
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - runStartedAtRef.current) / 1000),
    );

    void fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId,
        playerName,
        score: game.score,
        mode: game.mode,
        skin: skinChoice,
        durationSeconds,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Score save failed");
        }
        return loadScores(playerId);
      })
      .catch(() => setScoreError("This run could not sync to the leaderboard."));
  }, [game.mode, game.phase, game.score, loadScores, playerId, playerName, skinChoice]);

  useEffect(() => {
    if (game.phase !== "running") {
      return;
    }
    const movement = window.setInterval(() => {
      setGame((current) => stepGame(current));
    }, MOVE_INTERVAL_MS);
    return () => window.clearInterval(movement);
  }, [game.phase]);

  useEffect(() => {
    if (game.phase !== "running") {
      return;
    }
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      const elapsed = (current - previous) / 1000;
      previous = current;
      setGame((model) => tickTimer(model, elapsed));
    }, 100);
    return () => window.clearInterval(timer);
  }, [game.phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    const render = (now: number) => {
      drawGame(context, gameRef.current, now, skinRef.current);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const restart = useCallback(
    (mode: GameMode = gameRef.current.mode, startImmediately = false) => {
      runIdRef.current += 1;
      recordedRunRef.current = -1;
      runStartedAtRef.current = startImmediately ? Date.now() : null;
      setActiveSkin(resolveSkin(skinChoice));
      const nextGame = createGame(mode);
      setGame(startImmediately ? setPhase(nextGame, "running") : nextGame);
    },
    [skinChoice],
  );

  const markRunStarted = useCallback(() => {
    if (runStartedAtRef.current === null) {
      runStartedAtRef.current = Date.now();
    }
  }, []);

  const turn = useCallback(
    (direction: Direction) => {
      if (gameRef.current.phase === "ready") {
        markRunStarted();
      }
      setGame((current) => {
        const directed = queueDirection(current, direction);
        return current.phase === "ready"
          ? setPhase(directed, "running")
          : directed;
      });
    },
    [markRunStarted],
  );

  const toggleRunState = useCallback(() => {
    const current = gameRef.current;
    if (current.phase === "gameover") {
      restart(current.mode, true);
      return;
    }
    if (current.phase === "ready") {
      markRunStarted();
    }
    setGame((model) =>
      setPhase(model, model.phase === "running" ? "paused" : "running"),
    );
  }, [markRunStarted, restart]);

  const selectSkin = useCallback((id: string) => {
    setSkinChoice(id);
    setActiveSkin(resolveSkin(id));
    window.localStorage.setItem(SKIN_KEY, id);
  }, []);

  const savePlayerName = useCallback(() => {
    const nextName =
      playerName.trim().slice(0, 16).toUpperCase() || createPlayerName(playerId);
    setPlayerName(nextName);
    window.localStorage.setItem(PLAYER_NAME_KEY, nextName);
  }, [playerId, playerName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEYS[event.key];
      if (direction) {
        event.preventDefault();
        turn(direction);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggleRunState();
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [restart, toggleRunState, turn]);

  const best = useMemo(
    () =>
      history
        .filter((record) => record.mode === game.mode)
        .reduce((highest, record) => Math.max(highest, record.score), 0),
    [game.mode, history],
  );
  const historyBest = useMemo(
    () => history.reduce((highest, record) => Math.max(highest, record.score), 0),
    [history],
  );
  const scoreRows = scoreView === "global" ? leaderboard : history;
  const statusLabel =
    game.phase === "running"
      ? "LIVE"
      : game.phase === "paused"
        ? "PAUSED"
        : game.phase === "gameover"
          ? "RUN ENDED"
          : "STANDBY";

  return (
    <main className="site-shell">
      <div className="ambient ambient-cyan" />
      <div className="ambient ambient-pink" />
      <div className="ambient ambient-green" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Premium Neon Snake home">
          <span className="brand-mark" aria-hidden="true">
            NS
          </span>
          <span>
            <strong>NEON SNAKE</strong>
            <small>WEB ARCADE / ALPHA 0.2</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#game">Play</a>
          <a href="#leaderboard">Leaderboard</a>
          <a
            href="https://github.com/wwwyh007/Premium-Neon-Snake"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">
            <span /> PREMIUM ARCADE SYSTEM / ALPHA 0.2
          </p>
          <h1>
            OUTRUN
            <br />
            <em>THE GRID.</em>
          </h1>
        </div>
        <div className="hero-side">
          <p className="hero-copy">
            Pick your signal. Chase a personal record. Climb the live board.
            The desktop neon classic is now a browser-native arcade.
          </p>
          <div className="hero-stats">
            <span>
              <strong>05</strong> SKINS
            </span>
            <span>
              <strong>02</strong> MODES
            </span>
            <span>
              <strong>LIVE</strong> BOARD
            </span>
          </div>
        </div>
      </section>

      <section className="game-layout" id="game">
        <div className="game-console">
          <div className="console-header">
            <div className="status-cluster">
              <span className={`status-light status-${game.phase}`} />
              <span>{statusLabel}</span>
              <span className="console-signal">SKIN / {skinChoice.toUpperCase()}</span>
            </div>
            <div className="mode-switch" aria-label="Game mode">
              {(["classic", "obstacle"] as const).map((mode) => (
                <button
                  className={game.mode === mode ? "active" : ""}
                  key={mode}
                  type="button"
                  onClick={() => restart(mode)}
                  aria-pressed={game.mode === mode}
                >
                  {mode === "classic" ? "Classic" : "Obstacle"}
                </button>
              ))}
            </div>
          </div>

          <div className="hud" aria-live="polite">
            <div>
              <span>Score</span>
              <strong>{String(game.score).padStart(3, "0")}</strong>
            </div>
            <div>
              <span>Historic best</span>
              <strong>{String(best).padStart(3, "0")}</strong>
            </div>
            <div className={game.secondsRemaining <= 20 ? "danger" : ""}>
              <span>Time</span>
              <strong>{formatTime(game.secondsRemaining)}</strong>
            </div>
            <div>
              <span>Shield</span>
              <strong>{game.shields}</strong>
            </div>
          </div>

          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              aria-label="Playable neon snake game board"
            />

            {game.phase !== "running" && (
              <div className="game-overlay">
                <p>{game.phase === "gameover" ? game.lastReward : statusLabel}</p>
                <h2>
                  {game.phase === "gameover"
                    ? `Score ${game.score}`
                    : game.phase === "paused"
                      ? "Signal paused"
                      : "Ready to connect?"}
                </h2>
                <button type="button" onClick={toggleRunState}>
                  {game.phase === "paused" ? "Resume run" : "Start run"}
                </button>
                <small>WASD / Arrow keys · Space to pause · R to restart</small>
              </div>
            )}

            {game.phase === "running" && game.lastReward && (
              <div className="reward-signal">{game.lastReward}</div>
            )}
          </div>
        </div>

        <aside className="control-rail">
          <div className="rail-card control-card">
            <p className="rail-label">Signal lab</p>
            <h2>Choose your glow.</h2>
            <div className="skin-grid" aria-label="Snake color">
              {SKINS.map((skin) => (
                <button
                  key={skin.id}
                  className={skinChoice === skin.id ? "active" : ""}
                  type="button"
                  onClick={() => selectSkin(skin.id)}
                  aria-pressed={skinChoice === skin.id}
                  aria-label={`${skin.label} snake color`}
                >
                  <span style={{ background: skin.swatch }} />
                  <small>{skin.label}</small>
                </button>
              ))}
            </div>
            <p className="skin-note">
              Random generates a new two-tone signal on every reset.
            </p>
            <div className="keyboard-map" aria-hidden="true">
              <span />
              <kbd>W</kbd>
              <span />
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </div>
            <div className="touch-pad" aria-label="Touch controls">
              <span />
              <button type="button" onPointerDown={() => turn({ x: 0, y: -1 })}>
                ↑
              </button>
              <span />
              <button type="button" onPointerDown={() => turn({ x: -1, y: 0 })}>
                ←
              </button>
              <button type="button" onPointerDown={() => turn({ x: 0, y: 1 })}>
                ↓
              </button>
              <button type="button" onPointerDown={() => turn({ x: 1, y: 0 })}>
                →
              </button>
            </div>
            <div className="rail-actions">
              <button type="button" onClick={toggleRunState}>
                {game.phase === "running" ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => restart()}>
                Reset
              </button>
            </div>
          </div>

          <div className="rail-card leaderboard-card" id="leaderboard">
            <div className="leaderboard-heading">
              <div>
                <p className="rail-label">Score network</p>
                <h2>Hall of signals.</h2>
              </div>
              <span className={scoreError ? "offline" : "online"}>
                {scoreError ? "SYNC" : "LIVE"}
              </span>
            </div>

            <label className="player-alias">
              <span>Player alias</span>
              <input
                value={playerName}
                maxLength={16}
                onChange={(event) => setPlayerName(event.target.value)}
                onBlur={savePlayerName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>

            <div className="personal-records">
              <div>
                <span>All-time best</span>
                <strong>{String(historyBest).padStart(3, "0")}</strong>
              </div>
              <div>
                <span>Runs logged</span>
                <strong>{String(history.length).padStart(2, "0")}</strong>
              </div>
            </div>

            <div className="score-tabs" aria-label="Leaderboard view">
              <button
                className={scoreView === "global" ? "active" : ""}
                type="button"
                onClick={() => setScoreView("global")}
              >
                Global top 10
              </button>
              <button
                className={scoreView === "history" ? "active" : ""}
                type="button"
                onClick={() => setScoreView("history")}
              >
                My history
              </button>
            </div>

            <div className="score-list" aria-live="polite">
              {scoresLoading ? (
                <p className="score-empty">Connecting to the score network…</p>
              ) : scoreRows.length === 0 ? (
                <p className="score-empty">
                  Finish a run to become the first signal on this board.
                </p>
              ) : (
                scoreRows.slice(0, scoreView === "global" ? 10 : 8).map((record, index) => (
                  <div className="score-row" key={record.id}>
                    <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                    <span
                      className={`mini-skin mini-skin-${record.skin}`}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{record.playerName}</strong>
                      <small>
                        {record.mode} · {formatRunDate(record.playedAt)}
                      </small>
                    </div>
                    <b>{String(record.score).padStart(3, "0")}</b>
                  </div>
                ))
              )}
            </div>
            {scoreError && <p className="score-error">{scoreError}</p>}
          </div>

          <div className="rail-card roadmap-card" id="roadmap">
            <p className="rail-label">Transmission log</p>
            <ol>
              <li className="done">
                <span>01</span>
                <div>
                  <strong>Playable Web Alpha</strong>
                  <small>Canvas engine + responsive controls</small>
                </div>
              </li>
              <li className="done">
                <span>02</span>
                <div>
                  <strong>Skins & score network</strong>
                  <small>D1 leaderboard + persistent run history</small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Polish & sound</strong>
                  <small>Particles, audio feedback, challenge events</small>
                </div>
              </li>
            </ol>
          </div>
        </aside>
      </section>

      <footer>
        <span>BUILT BY WWWYH007</span>
        <span>PYGAME DNA / BROWSER NATIVE</span>
        <span>2026</span>
      </footer>
    </main>
  );
}
