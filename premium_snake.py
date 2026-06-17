'''
VISUAL STUDIO BEGINNER SETUP GUIDE

1. Install Python support in Visual Studio
   1) Close Visual Studio if it is already open.
   2) Open "Visual Studio Installer" from the Windows Start Menu.
   3) Find your installed Visual Studio version and click "Modify".
   4) In the "Workloads" tab, check "Python development".
   5) Keep "Python 3" selected in the optional components list.
   6) Click "Modify" or "Install" and wait for the installer to finish.

2. Install pygame from Visual Studio
   1) Open Visual Studio.
   2) Go to View -> Other Windows -> Python Environments.
   3) Select your Python environment on the left.
   4) Open the "Packages (PyPI)" or package search area.
   5) Search for "pygame".
   6) Click "Install pygame" and wait until installation completes.
   7) If Visual Studio asks to create or select an environment, choose your normal Python 3 environment.

3. Create and run a Python Application project
   1) In Visual Studio, choose File -> New -> Project.
   2) Search for "Python Application".
   3) Select "Python Application", then click Next.
   4) Name the project, choose a folder, and click Create.
   5) Replace the default .py file contents with this script, or add this script to the project.
   6) Right-click this .py file in Solution Explorer and choose "Set as Startup File".
   7) Press F5 to run with debugging, or Ctrl+F5 to run without debugging.
   8) A game window should open. Use the arrow keys or WASD to control the snake.
'''

from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Callable, Iterable

os.environ.setdefault("SDL_VIDEO_CENTERED", "1")

import pygame


class GameState(Enum):
    MAIN_MENU = "main_menu"
    PLAYING = "playing"
    LEADERBOARD = "leaderboard"
    GAME_OVER = "game_over"


class GameMode(Enum):
    CLASSIC = "Classic Mode"
    OBSTACLE = "Obstacle Mode"


class FoodType(Enum):
    NORMAL = "normal"
    SPECIAL = "special"


class RewardType(Enum):
    SHIELD = "Shield +1"
    TIME = "Time +30s"


@dataclass(frozen=True)
class Config:
    window_width: int = 800
    window_height: int = 600
    hud_height: int = 80
    cell_size: int = 20
    fps: int = 60
    move_interval: float = 0.095
    start_seconds: int = 300
    time_reward_seconds: int = 30
    special_spawn_chance: float = 0.10
    invincible_seconds: float = 1.0

    @property
    def grid_cols(self) -> int:
        return self.window_width // self.cell_size

    @property
    def grid_rows(self) -> int:
        return (self.window_height - self.hud_height) // self.cell_size

    @property
    def board_rect(self) -> pygame.Rect:
        return pygame.Rect(
            0,
            self.hud_height,
            self.grid_cols * self.cell_size,
            self.grid_rows * self.cell_size,
        )


class Palette:
    background = (9, 12, 22)
    panel = (18, 24, 42)
    panel_light = (28, 38, 67)
    cyan = (61, 220, 255)
    cyan_soft = (94, 235, 255)
    green = (75, 255, 149)
    green_dark = (23, 148, 91)
    magenta = (255, 69, 180)
    red = (255, 62, 86)
    orange = (255, 170, 64)
    yellow = (255, 224, 102)
    text = (234, 244, 255)
    muted = (136, 154, 181)
    dark_text = (8, 12, 20)
    obstacle = (112, 126, 158)
    obstacle_edge = (182, 199, 232)
    grid_line = (19, 27, 48)


class ScoreManager:
    def __init__(self, file_path: Path | None = None, limit: int = 5) -> None:
        self.file_path = file_path or Path(__file__).with_name("leaderboard.json")
        self.limit = limit
        self.scores: list[dict[str, object]] = []
        self.load()

    def load(self) -> None:
        if not self.file_path.exists():
            self.scores = []
            return

        try:
            data = json.loads(self.file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self.scores = []
            return

        raw_scores = data.get("scores", []) if isinstance(data, dict) else []
        parsed: list[dict[str, object]] = []
        for item in raw_scores:
            if not isinstance(item, dict):
                continue
            score = item.get("score")
            timestamp = item.get("timestamp")
            mode = item.get("mode", "Unknown")
            if isinstance(score, int) and isinstance(timestamp, str):
                parsed.append({"score": score, "timestamp": timestamp, "mode": str(mode)})

        self.scores = sorted(parsed, key=lambda row: int(row["score"]), reverse=True)[: self.limit]

    def save(self) -> None:
        payload = {"scores": self.scores}
        self.file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def personal_best(self) -> int:
        if not self.scores:
            return 0
        return int(self.scores[0]["score"])

    def qualifies(self, score: int) -> bool:
        if score <= 0:
            return False
        if len(self.scores) < self.limit:
            return True
        return score > int(self.scores[-1]["score"])

    def add_score(self, score: int, mode: GameMode) -> bool:
        is_new_high = score > self.personal_best()
        if self.qualifies(score):
            self.scores.append(
                {
                    "score": score,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "mode": mode.value,
                }
            )
            self.scores = sorted(self.scores, key=lambda row: int(row["score"]), reverse=True)[: self.limit]
            self.save()
        return is_new_high and score > 0

    def top_scores(self) -> list[dict[str, object]]:
        return list(self.scores)


def load_font(file_names: list[str], size: int, bold: bool = False) -> pygame.font.Font:
    fonts_dir = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    for file_name in file_names:
        font_path = fonts_dir / file_name
        if font_path.exists():
            font = pygame.font.Font(str(font_path), size)
            font.set_bold(bold)
            return font

    font = pygame.font.Font(None, size)
    font.set_bold(bold)
    return font


class Fonts:
    def __init__(self) -> None:
        pygame.font.init()
        self.title = load_font(["segoeuib.ttf", "seguisb.ttf", "segoeui.ttf"], 56, True)
        self.subtitle = load_font(["segoeui.ttf", "seguisb.ttf"], 22)
        self.button = load_font(["segoeuib.ttf", "seguisb.ttf", "segoeui.ttf"], 26, True)
        self.hud = load_font(["consolab.ttf", "consola.ttf", "segoeuib.ttf"], 22, True)
        self.body = load_font(["segoeui.ttf", "seguisb.ttf"], 21)
        self.body_bold = load_font(["segoeuib.ttf", "seguisb.ttf", "segoeui.ttf"], 22, True)
        self.small = load_font(["segoeui.ttf", "seguisb.ttf"], 16)
        self.score = load_font(["consolab.ttf", "consola.ttf", "segoeuib.ttf"], 42, True)


class Button:
    def __init__(
        self,
        rect: pygame.Rect,
        text: str,
        callback: Callable[[], None],
        fonts: Fonts,
        primary: bool = False,
    ) -> None:
        self.rect = rect
        self.text = text
        self.callback = callback
        self.fonts = fonts
        self.primary = primary
        self.hover_progress = 0.0

    def update(self, mouse_pos: tuple[int, int], dt: float) -> None:
        target = 1.0 if self.rect.collidepoint(mouse_pos) else 0.0
        speed = 12.0
        self.hover_progress += (target - self.hover_progress) * min(1.0, speed * dt)

    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.rect.collidepoint(event.pos):
                self.callback()

    def draw(self, surface: pygame.Surface) -> None:
        t = self.hover_progress
        base = Palette.cyan if self.primary else Palette.panel_light
        border = Palette.green if self.primary else Palette.cyan
        fill = lerp_color(base, Palette.green if self.primary else Palette.cyan, t * 0.45)
        glow_alpha = int(70 + 80 * t) if self.primary else int(30 + 65 * t)

        glow_rect = self.rect.inflate(18 + int(8 * t), 18 + int(8 * t))
        draw_rounded_glow(surface, glow_rect, border, glow_alpha, radius=18)
        pygame.draw.rect(surface, fill, self.rect, border_radius=14)
        pygame.draw.rect(surface, border, self.rect, width=2, border_radius=14)

        text_color = Palette.dark_text if self.primary else Palette.text
        text_surf = self.fonts.button.render(self.text, True, text_color)
        surface.blit(text_surf, text_surf.get_rect(center=self.rect.center))


class Snake:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.body: list[tuple[int, int]] = []
        self.direction = (1, 0)
        self.queued_direction = (1, 0)
        self.grow_pending = 0
        self.reset()

    def reset(self) -> None:
        cx = self.config.grid_cols // 2
        cy = self.config.grid_rows // 2
        self.body = [(cx, cy), (cx - 1, cy), (cx - 2, cy)]
        self.direction = (1, 0)
        self.queued_direction = (1, 0)
        self.grow_pending = 0

    @property
    def head(self) -> tuple[int, int]:
        return self.body[0]

    def queue_direction(self, new_direction: tuple[int, int]) -> None:
        if (new_direction[0] + self.direction[0], new_direction[1] + self.direction[1]) == (0, 0):
            return
        self.queued_direction = new_direction

    def snapshot(self) -> tuple[list[tuple[int, int]], tuple[int, int], int]:
        return list(self.body), self.direction, self.grow_pending

    def restore(self, snapshot: tuple[list[tuple[int, int]], tuple[int, int], int]) -> None:
        self.body, self.direction, self.grow_pending = list(snapshot[0]), snapshot[1], snapshot[2]
        self.queued_direction = self.direction

    def move(self) -> None:
        self.direction = self.queued_direction
        hx, hy = self.head
        dx, dy = self.direction
        self.body.insert(0, (hx + dx, hy + dy))
        if self.grow_pending > 0:
            self.grow_pending -= 1
        else:
            self.body.pop()

    def grow(self, amount: int = 1) -> None:
        self.grow_pending += amount

    def occupies(self) -> set[tuple[int, int]]:
        return set(self.body)

    def collides_with_self(self) -> bool:
        return self.head in self.body[1:]

    def collides_with_wall(self) -> bool:
        x, y = self.head
        return x < 0 or x >= self.config.grid_cols or y < 0 or y >= self.config.grid_rows

    def choose_safe_direction(self, blocked: set[tuple[int, int]]) -> None:
        directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]
        random.shuffle(directions)
        hx, hy = self.head
        for direction in directions:
            if (direction[0] + self.direction[0], direction[1] + self.direction[1]) == (0, 0):
                continue
            nx, ny = hx + direction[0], hy + direction[1]
            if 0 <= nx < self.config.grid_cols and 0 <= ny < self.config.grid_rows and (nx, ny) not in blocked:
                self.direction = direction
                self.queued_direction = direction
                return
        self.queued_direction = self.direction


class Food:
    def __init__(self, position: tuple[int, int], food_type: FoodType) -> None:
        self.position = position
        self.type = food_type
        self.created_at = pygame.time.get_ticks() / 1000.0


class FoodSpawner:
    def __init__(self, config: Config) -> None:
        self.config = config

    def spawn(
        self,
        snake_cells: Iterable[tuple[int, int]],
        obstacle_cells: Iterable[tuple[int, int]],
        mode: GameMode,
    ) -> Food:
        blocked = set(snake_cells) | set(obstacle_cells)
        available = [
            (x, y)
            for x in range(self.config.grid_cols)
            for y in range(self.config.grid_rows)
            if (x, y) not in blocked
        ]
        if not available:
            return Food((0, 0), FoodType.NORMAL)
        position = random.choice(available)
        food_type = FoodType.NORMAL
        if mode == GameMode.CLASSIC and random.random() < self.config.special_spawn_chance:
            food_type = FoodType.SPECIAL
        return Food(position, food_type)


class ObstacleManager:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.cells: set[tuple[int, int]] = set()

    def clear(self) -> None:
        self.cells.clear()

    def generate(self, snake_cells: Iterable[tuple[int, int]]) -> None:
        self.cells.clear()
        snake_zone = set(snake_cells)
        reserved: set[tuple[int, int]] = set()
        sx, sy = self.config.grid_cols // 2, self.config.grid_rows // 2
        for x in range(sx - 5, sx + 6):
            for y in range(sy - 4, sy + 5):
                reserved.add((x, y))

        target_blocks = random.randint(3, 5)
        attempts = 0
        while len(self._clusters()) < target_blocks and attempts < 200:
            attempts += 1
            horizontal = random.choice([True, False])
            length = random.randint(4, 8)
            start_x = random.randint(2, self.config.grid_cols - 3)
            start_y = random.randint(2, self.config.grid_rows - 3)

            block = []
            for i in range(length):
                x = start_x + i if horizontal else start_x
                y = start_y if horizontal else start_y + i
                if 1 <= x < self.config.grid_cols - 1 and 1 <= y < self.config.grid_rows - 1:
                    block.append((x, y))

            block_set = set(block)
            if not block_set:
                continue
            if block_set & snake_zone or block_set & reserved or block_set & self.cells:
                continue
            self.cells.update(block_set)

    def _clusters(self) -> list[set[tuple[int, int]]]:
        remaining = set(self.cells)
        clusters: list[set[tuple[int, int]]] = []
        while remaining:
            start = remaining.pop()
            cluster = {start}
            stack = [start]
            while stack:
                x, y = stack.pop()
                for neighbor in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        cluster.add(neighbor)
                        stack.append(neighbor)
            clusters.append(cluster)
        return clusters


class GameSession:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.snake = Snake(config)
        self.obstacles = ObstacleManager(config)
        self.food_spawner = FoodSpawner(config)
        self.food = Food((0, 0), FoodType.NORMAL)
        self.mode = GameMode.CLASSIC
        self.score = 0
        self.shields = 0
        self.seconds_remaining = float(config.start_seconds)
        self.invincible_until = 0.0
        self.last_reward_text = ""
        self.last_reward_until = 0.0

    def start(self, mode: GameMode) -> None:
        self.mode = mode
        self.snake.reset()
        self.obstacles.clear()
        if mode == GameMode.OBSTACLE:
            self.obstacles.generate(self.snake.occupies())
        self.score = 0
        self.shields = 0
        self.seconds_remaining = float(self.config.start_seconds)
        self.invincible_until = 0.0
        self.last_reward_text = ""
        self.last_reward_until = 0.0
        self.food = self.food_spawner.spawn(self.snake.occupies(), self.obstacles.cells, mode)

    def is_invincible(self, now: float) -> bool:
        return now < self.invincible_until

    def tick_timer(self, dt: float) -> None:
        self.seconds_remaining = max(0.0, self.seconds_remaining - dt)

    def apply_food(self, now: float) -> None:
        self.score += 1
        self.snake.grow(1)
        if self.food.type == FoodType.SPECIAL:
            reward = random.choice([RewardType.SHIELD, RewardType.TIME])
            if reward == RewardType.SHIELD:
                self.shields += 1
                self.last_reward_text = "+1 SHIELD"
            else:
                self.seconds_remaining += self.config.time_reward_seconds
                self.last_reward_text = "+30 SECONDS"
            self.last_reward_until = now + 1.5
        self.food = self.food_spawner.spawn(self.snake.occupies(), self.obstacles.cells, self.mode)

    def handle_collision(self, snapshot: tuple[list[tuple[int, int]], tuple[int, int], int], now: float) -> bool:
        collision = (
            self.snake.collides_with_wall()
            or self.snake.collides_with_self()
            or self.snake.head in self.obstacles.cells
        )
        if not collision:
            return False

        if self.is_invincible(now):
            self.snake.restore(snapshot)
            blocked = self.snake.occupies() | self.obstacles.cells
            self.snake.choose_safe_direction(blocked)
            return False

        if self.shields > 0:
            self.shields -= 1
            self.snake.restore(snapshot)
            blocked = self.snake.occupies() | self.obstacles.cells
            self.snake.choose_safe_direction(blocked)
            self.invincible_until = now + self.config.invincible_seconds
            self.last_reward_text = "SHIELD BROKEN"
            self.last_reward_until = now + 1.2
            return False

        return True


class Renderer:
    def __init__(self, screen: pygame.Surface, config: Config, fonts: Fonts) -> None:
        self.screen = screen
        self.config = config
        self.fonts = fonts

    def draw_background(self, now: float) -> None:
        self.screen.fill(Palette.background)
        board = self.config.board_rect
        pygame.draw.rect(self.screen, (7, 11, 20), board)

        for y in range(board.top, board.bottom, self.config.cell_size):
            color = Palette.grid_line if (y // self.config.cell_size) % 2 == 0 else (15, 22, 39)
            pygame.draw.line(self.screen, color, (board.left, y), (board.right, y))
        for x in range(board.left, board.right, self.config.cell_size):
            color = Palette.grid_line if (x // self.config.cell_size) % 2 == 0 else (15, 22, 39)
            pygame.draw.line(self.screen, color, (x, board.top), (x, board.bottom))

        pulse = 35 + int(18 * math.sin(now * 1.7))
        draw_rounded_glow(self.screen, board.inflate(-16, -16), Palette.cyan, pulse, radius=26)
        pygame.draw.rect(self.screen, Palette.panel, board, width=2, border_radius=16)

    def draw_hud(self, session: GameSession, best: int, now: float) -> None:
        hud_rect = pygame.Rect(0, 0, self.config.window_width, self.config.hud_height)
        pygame.draw.rect(self.screen, Palette.panel, hud_rect)
        pygame.draw.line(self.screen, Palette.cyan, (0, hud_rect.bottom - 1), (self.config.window_width, hud_rect.bottom - 1), 2)

        timer = format_seconds(int(math.ceil(session.seconds_remaining)))
        parts = [
            f"SCORE {session.score}",
            f"BEST {best}",
            f"TIME {timer}",
            f"SHIELD {session.shields}",
        ]
        x = 24
        for index, text in enumerate(parts):
            color = Palette.yellow if index == 2 and session.seconds_remaining <= 30 else Palette.text
            label = self.fonts.hud.render(text, True, color)
            self.screen.blit(label, (x, 20))
            x += 185

        mode = self.fonts.small.render(session.mode.value.upper(), True, Palette.muted)
        self.screen.blit(mode, (24, 52))

        if now < session.last_reward_until and session.last_reward_text:
            alpha = int(180 + 75 * math.sin(now * 16))
            reward = self.fonts.body_bold.render(session.last_reward_text, True, Palette.green)
            reward.set_alpha(alpha)
            self.screen.blit(reward, reward.get_rect(midtop=(self.config.window_width // 2, 48)))

    def draw_snake(self, session: GameSession, now: float) -> None:
        flashing = session.is_invincible(now) and int(now * 12) % 2 == 0
        for index, (x, y) in enumerate(reversed(session.snake.body)):
            actual_index = len(session.snake.body) - index - 1
            rect = cell_rect(self.config, x, y).inflate(-3, -3)
            progress = actual_index / max(1, len(session.snake.body) - 1)
            color = lerp_color(Palette.green, Palette.cyan_soft, progress * 0.75)
            if flashing:
                color = Palette.yellow
            pygame.draw.rect(self.screen, color, rect, border_radius=7)
            if actual_index == 0:
                draw_rounded_glow(self.screen, rect.inflate(12, 12), Palette.green, 90, radius=14)
                eye_color = Palette.dark_text
                dx, dy = session.snake.direction
                eye_offsets = self._eye_offsets(dx, dy)
                for ox, oy in eye_offsets:
                    pygame.draw.circle(self.screen, eye_color, (rect.centerx + ox, rect.centery + oy), 3)

    def _eye_offsets(self, dx: int, dy: int) -> list[tuple[int, int]]:
        if dx != 0:
            return [(5 * dx, -4), (5 * dx, 4)]
        return [(-4, 5 * dy), (4, 5 * dy)]

    def draw_food(self, food: Food, now: float) -> None:
        x, y = food.position
        rect = cell_rect(self.config, x, y)
        if food.type == FoodType.SPECIAL:
            pulse = 1.0 + 0.18 * math.sin(now * 9.0)
            radius = int(9 * pulse)
            draw_circle_glow(self.screen, rect.center, Palette.red, 110, 28)
            pygame.draw.circle(self.screen, Palette.red, rect.center, radius)
            pygame.draw.circle(self.screen, Palette.yellow, rect.center, max(3, radius // 3))
        else:
            draw_circle_glow(self.screen, rect.center, Palette.magenta, 85, 20)
            pygame.draw.circle(self.screen, Palette.magenta, rect.center, 7)
            pygame.draw.circle(self.screen, Palette.text, (rect.centerx - 2, rect.centery - 2), 2)

    def draw_obstacles(self, obstacles: ObstacleManager) -> None:
        for x, y in obstacles.cells:
            rect = cell_rect(self.config, x, y).inflate(-2, -2)
            pygame.draw.rect(self.screen, Palette.obstacle, rect, border_radius=5)
            pygame.draw.rect(self.screen, Palette.obstacle_edge, rect, width=1, border_radius=5)

    def draw_menu(self, buttons: list[Button], now: float) -> None:
        self.screen.fill(Palette.background)
        self._draw_title_art(now)
        title = self.fonts.title.render("NEON SNAKE", True, Palette.text)
        shadow = self.fonts.title.render("NEON SNAKE", True, Palette.cyan)
        self.screen.blit(shadow, shadow.get_rect(center=(self.config.window_width // 2 + 3, 116 + 3)))
        self.screen.blit(title, title.get_rect(center=(self.config.window_width // 2, 116)))
        subtitle = self.fonts.subtitle.render("Classic arcade control, modern premium polish", True, Palette.muted)
        self.screen.blit(subtitle, subtitle.get_rect(center=(self.config.window_width // 2, 164)))
        for button in buttons:
            button.draw(self.screen)

    def _draw_title_art(self, now: float) -> None:
        center = (self.config.window_width // 2, 130)
        for i in range(9):
            angle = now * 0.8 + i * 0.7
            radius = 120 + 12 * math.sin(now + i)
            pos = (int(center[0] + math.cos(angle) * radius), int(center[1] + math.sin(angle) * 26))
            draw_circle_glow(self.screen, pos, Palette.cyan if i % 2 else Palette.magenta, 35, 18)

    def draw_leaderboard(self, scores: list[dict[str, object]], buttons: list[Button]) -> None:
        self.screen.fill(Palette.background)
        title = self.fonts.title.render("PERSONAL BEST", True, Palette.text)
        self.screen.blit(title, title.get_rect(center=(self.config.window_width // 2, 90)))

        panel = pygame.Rect(130, 145, 540, 300)
        draw_rounded_glow(self.screen, panel, Palette.cyan, 60, radius=22)
        pygame.draw.rect(self.screen, Palette.panel, panel, border_radius=18)
        pygame.draw.rect(self.screen, Palette.cyan, panel, width=2, border_radius=18)

        if scores:
            for i, row in enumerate(scores):
                y = 178 + i * 50
                rank = self.fonts.body_bold.render(f"#{i + 1}", True, Palette.yellow)
                score = self.fonts.body_bold.render(str(row["score"]), True, Palette.green)
                mode = self.fonts.small.render(str(row.get("mode", "Unknown")), True, Palette.muted)
                timestamp = self.fonts.small.render(str(row["timestamp"]), True, Palette.muted)
                self.screen.blit(rank, (170, y))
                self.screen.blit(score, (240, y))
                self.screen.blit(mode, (340, y + 2))
                self.screen.blit(timestamp, (340, y + 24))
        else:
            empty = self.fonts.body.render("No scores yet. Start a run and claim the board.", True, Palette.muted)
            self.screen.blit(empty, empty.get_rect(center=panel.center))

        for button in buttons:
            button.draw(self.screen)

    def draw_game_over(self, session: GameSession, is_new_high: bool, buttons: list[Button], now: float) -> None:
        self.screen.fill(Palette.background)
        title_text = "NEW HIGH SCORE" if is_new_high else "GAME OVER"
        color = Palette.yellow if is_new_high and int(now * 5) % 2 == 0 else Palette.text
        title = self.fonts.title.render(title_text, True, color)
        self.screen.blit(title, title.get_rect(center=(self.config.window_width // 2, 120)))

        score = self.fonts.score.render(str(session.score), True, Palette.green)
        label = self.fonts.subtitle.render("FINAL SCORE", True, Palette.muted)
        self.screen.blit(label, label.get_rect(center=(self.config.window_width // 2, 205)))
        self.screen.blit(score, score.get_rect(center=(self.config.window_width // 2, 255)))

        for button in buttons:
            button.draw(self.screen)


class SnakeGameApp:
    def __init__(self) -> None:
        pygame.init()
        self.config = Config()
        self.screen = pygame.display.set_mode((self.config.window_width, self.config.window_height))
        pygame.display.set_caption("Premium Neon Snake")
        self.clock = pygame.time.Clock()
        self.fonts = Fonts()
        self.renderer = Renderer(self.screen, self.config, self.fonts)
        self.score_manager = ScoreManager()
        self.session = GameSession(self.config)
        self.state = GameState.MAIN_MENU
        self.running = True
        self.move_accumulator = 0.0
        self.game_over_new_high = False
        self.menu_buttons = self._make_menu_buttons()
        self.leaderboard_buttons = self._make_leaderboard_buttons()
        self.game_over_buttons = self._make_game_over_buttons()

    def _make_menu_buttons(self) -> list[Button]:
        cx = self.config.window_width // 2
        return [
            Button(pygame.Rect(cx - 180, 230, 360, 58), "Play Classic Mode", lambda: self.start_game(GameMode.CLASSIC), self.fonts, True),
            Button(pygame.Rect(cx - 180, 305, 360, 58), "Play Obstacle Mode", lambda: self.start_game(GameMode.OBSTACLE), self.fonts),
            Button(pygame.Rect(cx - 180, 380, 360, 58), "View Personal Leaderboard", self.show_leaderboard, self.fonts),
        ]

    def _make_leaderboard_buttons(self) -> list[Button]:
        return [
            Button(pygame.Rect(260, 485, 280, 56), "Back to Menu", self.show_menu, self.fonts, True)
        ]

    def _make_game_over_buttons(self) -> list[Button]:
        return [
            Button(pygame.Rect(210, 345, 180, 58), "Restart", self.restart_game, self.fonts, True),
            Button(pygame.Rect(410, 345, 180, 58), "Back to Menu", self.show_menu, self.fonts),
        ]

    def start_game(self, mode: GameMode) -> None:
        self.session.start(mode)
        self.move_accumulator = 0.0
        self.game_over_new_high = False
        self.state = GameState.PLAYING

    def restart_game(self) -> None:
        self.start_game(self.session.mode)

    def show_menu(self) -> None:
        self.state = GameState.MAIN_MENU

    def show_leaderboard(self) -> None:
        self.score_manager.load()
        self.state = GameState.LEADERBOARD

    def end_game(self) -> None:
        self.game_over_new_high = self.score_manager.add_score(self.session.score, self.session.mode)
        self.state = GameState.GAME_OVER

    def run(self) -> None:
        while self.running:
            dt = self.clock.tick(self.config.fps) / 1000.0
            now = pygame.time.get_ticks() / 1000.0
            self.handle_events()
            self.update(dt, now)
            self.draw(now)
            pygame.display.flip()
        pygame.quit()

    def handle_events(self) -> None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                self._handle_keydown(event.key)

            for button in self.active_buttons():
                button.handle_event(event)

    def _handle_keydown(self, key: int) -> None:
        mapping = {
            pygame.K_UP: (0, -1),
            pygame.K_w: (0, -1),
            pygame.K_DOWN: (0, 1),
            pygame.K_s: (0, 1),
            pygame.K_LEFT: (-1, 0),
            pygame.K_a: (-1, 0),
            pygame.K_RIGHT: (1, 0),
            pygame.K_d: (1, 0),
        }
        if self.state == GameState.PLAYING and key in mapping:
            self.session.snake.queue_direction(mapping[key])
        elif key == pygame.K_ESCAPE:
            if self.state == GameState.PLAYING:
                self.show_menu()
            else:
                self.running = False
        elif self.state == GameState.GAME_OVER and key in (pygame.K_RETURN, pygame.K_SPACE):
            self.restart_game()

    def active_buttons(self) -> list[Button]:
        if self.state == GameState.MAIN_MENU:
            return self.menu_buttons
        if self.state == GameState.LEADERBOARD:
            return self.leaderboard_buttons
        if self.state == GameState.GAME_OVER:
            return self.game_over_buttons
        return []

    def update(self, dt: float, now: float) -> None:
        mouse_pos = pygame.mouse.get_pos()
        for button in self.active_buttons():
            button.update(mouse_pos, dt)

        if self.state != GameState.PLAYING:
            return

        self.session.tick_timer(dt)
        if self.session.seconds_remaining <= 0.0:
            self.end_game()
            return

        self.move_accumulator += dt
        while self.move_accumulator >= self.config.move_interval and self.state == GameState.PLAYING:
            self.move_accumulator -= self.config.move_interval
            self._step_game(now)

    def _step_game(self, now: float) -> None:
        snapshot = self.session.snake.snapshot()
        self.session.snake.move()
        died = self.session.handle_collision(snapshot, now)
        if died:
            self.end_game()
            return

        if self.session.snake.head == self.session.food.position:
            self.session.apply_food(now)

    def draw(self, now: float) -> None:
        if self.state == GameState.MAIN_MENU:
            self.renderer.draw_menu(self.menu_buttons, now)
        elif self.state == GameState.LEADERBOARD:
            self.renderer.draw_leaderboard(self.score_manager.top_scores(), self.leaderboard_buttons)
        elif self.state == GameState.GAME_OVER:
            self.renderer.draw_game_over(self.session, self.game_over_new_high, self.game_over_buttons, now)
        elif self.state == GameState.PLAYING:
            self.renderer.draw_background(now)
            self.renderer.draw_obstacles(self.session.obstacles)
            self.renderer.draw_food(self.session.food, now)
            self.renderer.draw_snake(self.session, now)
            self.renderer.draw_hud(self.session, self.score_manager.personal_best(), now)


def cell_rect(config: Config, x: int, y: int) -> pygame.Rect:
    return pygame.Rect(
        x * config.cell_size,
        config.hud_height + y * config.cell_size,
        config.cell_size,
        config.cell_size,
    )


def format_seconds(seconds: int) -> str:
    minutes = max(0, seconds) // 60
    remaining = max(0, seconds) % 60
    return f"{minutes:02d}:{remaining:02d}"


def lerp_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def draw_rounded_glow(surface: pygame.Surface, rect: pygame.Rect, color: tuple[int, int, int], alpha: int, radius: int) -> None:
    glow = pygame.Surface(rect.size, pygame.SRCALPHA)
    pygame.draw.rect(glow, (*color, max(0, min(255, alpha))), glow.get_rect(), border_radius=radius)
    surface.blit(glow, rect.topleft, special_flags=pygame.BLEND_PREMULTIPLIED)


def draw_circle_glow(surface: pygame.Surface, center: tuple[int, int], color: tuple[int, int, int], alpha: int, radius: int) -> None:
    size = radius * 2
    glow = pygame.Surface((size, size), pygame.SRCALPHA)
    for r in range(radius, 0, -2):
        local_alpha = int(alpha * (r / radius) ** 2 * 0.28)
        pygame.draw.circle(glow, (*color, local_alpha), (radius, radius), r)
    surface.blit(glow, (center[0] - radius, center[1] - radius), special_flags=pygame.BLEND_PREMULTIPLIED)


if __name__ == "__main__":
    SnakeGameApp().run()
