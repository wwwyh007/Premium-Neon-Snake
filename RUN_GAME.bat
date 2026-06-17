@echo off
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

if exist "%PROJECT_DIR%.venv\Scripts\python.exe" (
    "%PROJECT_DIR%.venv\Scripts\python.exe" premium_snake.py
) else if exist "D:\Coding\Python\Python313\python.exe" (
    "D:\Coding\Python\Python313\python.exe" premium_snake.py
) else (
    py -3 premium_snake.py
)

pause
