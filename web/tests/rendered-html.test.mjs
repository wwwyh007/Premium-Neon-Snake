import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Premium Neon Snake product shell", async () => {
  const [page, layout, game] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/NeonSnakeGame.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Premium Neon Snake — Web Alpha/);
  assert.match(layout, /browser-native neon arcade/);
  assert.match(game, /OUTRUN/);
  assert.match(game, /THE GRID/);
  assert.match(game, /Playable Web Alpha/);
  assert.match(game, /Choose your glow/);
  assert.match(game, /Hall of signals/);
  assert.match(game, /Historic best/);
  assert.doesNotMatch(`${page}\n${layout}\n${game}`, /codex-preview|Your site is taking shape/i);
});
