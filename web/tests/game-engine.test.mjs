import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_COLUMNS,
  createGame,
  queueDirection,
  setPhase,
  stepGame,
  tickTimer,
} from "../app/game-engine.ts";

const fixedRandom = () => 0.75;

test("does not allow an immediate reverse turn", () => {
  const game = createGame("classic", fixedRandom);
  const reversed = queueDirection(game, { x: -1, y: 0 });
  assert.deepEqual(reversed.queuedDirection, { x: 1, y: 0 });
});

test("does not collapse two queued turns into a reverse move", () => {
  const game = createGame("classic", fixedRandom);
  const up = queueDirection(game, { x: 0, y: -1 });
  const illegalDown = queueDirection(up, { x: 0, y: 1 });
  const illegalLeft = queueDirection(up, { x: -1, y: 0 });
  assert.deepEqual(illegalDown.queuedDirection, { x: 0, y: -1 });
  assert.deepEqual(illegalLeft.queuedDirection, { x: 0, y: -1 });
});

test("moves one cell while keeping the same length", () => {
  const game = setPhase(createGame("classic", fixedRandom), "running");
  const moved = stepGame(game, fixedRandom);
  assert.equal(moved.snake.length, game.snake.length);
  assert.equal(moved.snake[0].x, game.snake[0].x + 1);
});

test("ends a run when the snake crosses the grid edge", () => {
  const game = {
    ...setPhase(createGame("classic", fixedRandom), "running"),
    snake: [
      { x: BOARD_COLUMNS - 1, y: 4 },
      { x: BOARD_COLUMNS - 2, y: 4 },
    ],
  };
  assert.equal(stepGame(game, fixedRandom).phase, "gameover");
});

test("expires the run timer", () => {
  const game = {
    ...setPhase(createGame("classic", fixedRandom), "running"),
    secondsRemaining: 0.05,
  };
  const expired = tickTimer(game, 0.1);
  assert.equal(expired.secondsRemaining, 0);
  assert.equal(expired.phase, "gameover");
});
