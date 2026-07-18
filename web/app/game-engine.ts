export const BOARD_COLUMNS = 32;
export const BOARD_ROWS = 24;
export const START_SECONDS = 180;

export type GameMode = "classic" | "obstacle";
export type GamePhase = "ready" | "running" | "paused" | "gameover";
export type Direction = Readonly<{ x: number; y: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type Food = Readonly<{ position: Point; kind: "normal" | "special" }>;

export type GameModel = Readonly<{
  mode: GameMode;
  phase: GamePhase;
  snake: readonly Point[];
  direction: Direction;
  queuedDirection: Direction;
  food: Food;
  obstacles: readonly Point[];
  score: number;
  shields: number;
  secondsRemaining: number;
  lastReward: string;
}>;

type RandomSource = () => number;

const DIRECTIONS: readonly Direction[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function keyOf(point: Point): string {
  return `${point.x},${point.y}`;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function pick<T>(items: readonly T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function makeObstacles(random: RandomSource): readonly Point[] {
  const cells = new Map<string, Point>();
  const reserved = new Set<string>();
  const centerX = Math.floor(BOARD_COLUMNS / 2);
  const centerY = Math.floor(BOARD_ROWS / 2);

  for (let x = centerX - 5; x <= centerX + 5; x += 1) {
    for (let y = centerY - 4; y <= centerY + 4; y += 1) {
      reserved.add(`${x},${y}`);
    }
  }

  for (let cluster = 0; cluster < 5; cluster += 1) {
    const horizontal = random() >= 0.5;
    const length = 4 + Math.floor(random() * 4);
    const startX = 2 + Math.floor(random() * (BOARD_COLUMNS - 6));
    const startY = 2 + Math.floor(random() * (BOARD_ROWS - 6));

    for (let index = 0; index < length; index += 1) {
      const point = {
        x: horizontal ? startX + index : startX,
        y: horizontal ? startY : startY + index,
      };
      const key = keyOf(point);
      if (
        point.x > 0 &&
        point.x < BOARD_COLUMNS - 1 &&
        point.y > 0 &&
        point.y < BOARD_ROWS - 1 &&
        !reserved.has(key)
      ) {
        cells.set(key, point);
      }
    }
  }

  return [...cells.values()];
}

export function spawnFood(
  snake: readonly Point[],
  obstacles: readonly Point[],
  mode: GameMode,
  random: RandomSource = Math.random,
): Food {
  const blocked = new Set([...snake, ...obstacles].map(keyOf));
  const openCells: Point[] = [];

  for (let y = 0; y < BOARD_ROWS; y += 1) {
    for (let x = 0; x < BOARD_COLUMNS; x += 1) {
      if (!blocked.has(`${x},${y}`)) {
        openCells.push({ x, y });
      }
    }
  }

  const position = pick(openCells, random) ?? { x: 0, y: 0 };
  const kind = mode === "classic" && random() < 0.12 ? "special" : "normal";
  return { position, kind };
}

export function createGame(
  mode: GameMode = "classic",
  random: RandomSource = Math.random,
): GameModel {
  const centerX = Math.floor(BOARD_COLUMNS / 2);
  const centerY = Math.floor(BOARD_ROWS / 2);
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ] as const;
  const obstacles = mode === "obstacle" ? makeObstacles(random) : [];

  return {
    mode,
    phase: "ready",
    snake,
    direction: { x: 1, y: 0 },
    queuedDirection: { x: 1, y: 0 },
    food: spawnFood(snake, obstacles, mode, random),
    obstacles,
    score: 0,
    shields: 0,
    secondsRemaining: START_SECONDS,
    lastReward: "",
  };
}

export function setPhase(model: GameModel, phase: GamePhase): GameModel {
  return { ...model, phase };
}

export function queueDirection(
  model: GameModel,
  direction: Direction,
): GameModel {
  const reversesCurrent =
    direction.x + model.direction.x === 0 &&
    direction.y + model.direction.y === 0;
  const reversesQueued =
    direction.x + model.queuedDirection.x === 0 &&
    direction.y + model.queuedDirection.y === 0;

  if (reversesCurrent || reversesQueued) {
    return model;
  }

  return { ...model, queuedDirection: direction };
}

function findSafeDirection(model: GameModel): Direction {
  const blocked = new Set(
    [...model.snake.slice(0, -1), ...model.obstacles].map(keyOf),
  );
  const head = model.snake[0];

  return (
    DIRECTIONS.find((direction) => {
      const reverses =
        direction.x + model.direction.x === 0 &&
        direction.y + model.direction.y === 0;
      const next = { x: head.x + direction.x, y: head.y + direction.y };
      return (
        !reverses &&
        next.x >= 0 &&
        next.x < BOARD_COLUMNS &&
        next.y >= 0 &&
        next.y < BOARD_ROWS &&
        !blocked.has(keyOf(next))
      );
    }) ?? model.direction
  );
}

export function stepGame(
  model: GameModel,
  random: RandomSource = Math.random,
): GameModel {
  if (model.phase !== "running") {
    return model;
  }

  const direction = model.queuedDirection;
  const head = model.snake[0];
  const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
  const eatsFood = samePoint(nextHead, model.food.position);
  const bodyToCheck = eatsFood ? model.snake : model.snake.slice(0, -1);
  const hitsWall =
    nextHead.x < 0 ||
    nextHead.x >= BOARD_COLUMNS ||
    nextHead.y < 0 ||
    nextHead.y >= BOARD_ROWS;
  const hitsBody = bodyToCheck.some((point) => samePoint(point, nextHead));
  const hitsObstacle = model.obstacles.some((point) =>
    samePoint(point, nextHead),
  );

  if (hitsWall || hitsBody || hitsObstacle) {
    if (model.shields > 0) {
      const safeDirection = findSafeDirection(model);
      return {
        ...model,
        direction: safeDirection,
        queuedDirection: safeDirection,
        shields: model.shields - 1,
        lastReward: "SHIELD BROKEN",
      };
    }
    return { ...model, phase: "gameover", lastReward: "GRID LOCKED" };
  }

  const snake = [nextHead, ...model.snake];
  if (!eatsFood) {
    snake.pop();
    return { ...model, snake, direction, lastReward: "" };
  }

  let shields = model.shields;
  let secondsRemaining = model.secondsRemaining;
  let lastReward = "SIGNAL +1";

  if (model.food.kind === "special") {
    if (random() < 0.5) {
      shields += 1;
      lastReward = "SHIELD +1";
    } else {
      secondsRemaining += 20;
      lastReward = "TIME +20S";
    }
  }

  return {
    ...model,
    snake,
    direction,
    food: spawnFood(snake, model.obstacles, model.mode, random),
    score: model.score + 1,
    shields,
    secondsRemaining,
    lastReward,
  };
}

export function tickTimer(model: GameModel, elapsedSeconds: number): GameModel {
  if (model.phase !== "running") {
    return model;
  }
  const secondsRemaining = Math.max(0, model.secondsRemaining - elapsedSeconds);
  return {
    ...model,
    secondsRemaining,
    phase: secondsRemaining === 0 ? "gameover" : model.phase,
    lastReward: secondsRemaining === 0 ? "TIME EXPIRED" : model.lastReward,
  };
}
