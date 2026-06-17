# Contributing to Premium Neon Snake

感谢你愿意参与 Premium Neon Snake。这个项目的定位是从一个完整的桌面小游戏开始，逐步演进成更容易协作、更容易扩展的开源项目。

## 本地开发

```powershell
git clone https://github.com/wwwyh007/Premium-Neon-Snake.git
cd Premium-Neon-Snake

python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
python premium_snake.py
```

## 分支命名

- `feature/<name>`：新功能
- `fix/<name>`：Bug 修复
- `docs/<name>`：文档、截图、README
- `refactor/<name>`：代码结构调整

示例：

```text
feature/sound-effects
fix/leaderboard-save
docs/readme-preview
refactor/game-session
```

## 提交建议

提交信息尽量简洁明确：

```text
feat: add pause menu
fix: prevent reverse direction input
docs: update visual studio setup
refactor: split renderer from game loop
```

## 代码风格

- 优先保持代码清楚、可读、容易运行。
- 不提交 `.venv/`、`.vs/`、`__pycache__/`、`leaderboard.json`。
- 修改玩法时，请确认 Classic Mode 和 Obstacle Mode 都能正常运行。
- 修改存档逻辑时，请保护已有 `leaderboard.json` 的兼容性。
- UI 调整需要检查 800x600 窗口下文字是否溢出。

## Pull Request 检查清单

提交 PR 前请确认：

- 游戏可以正常启动。
- 菜单按钮可以点击。
- Classic Mode 可以吃普通食物和特殊食物。
- Obstacle Mode 不会把食物刷在障碍物里。
- Game Over 页面可以返回菜单或重新开始。
- README 或文档在相关功能变化后同步更新。

## 适合参与的任务

- 音效、背景音乐和静音开关。
- 暂停菜单、设置菜单、难度设置。
- 游戏手柄支持。
- 更漂亮的排行榜页面。
- 关卡系统或每日挑战模式。
- 单元测试和基础 CI。
- 将单文件架构逐步拆分为模块。

## 讨论方式

如果你不确定某个改动是否适合，请先开 Issue 描述想法。这个项目欢迎小步提交，清晰解释，比一次性大改更容易被 review。
