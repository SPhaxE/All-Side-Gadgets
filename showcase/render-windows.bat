@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==== Visual FX Reel - 本地 GPU 渲染 ====
where node >nul 2>nul || (echo [错误] 没找到 Node.js，请先安装 https://nodejs.org （LTS 版） & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo [错误] 没找到 ffmpeg，请安装并加入 PATH（推荐 https://www.gyan.dev/ffmpeg/builds/ 的 full 版） & pause & exit /b 1)
if not exist node_modules\playwright (
  echo [1/3] 安装依赖...
  call npm install || (pause & exit /b 1)
  call npx playwright install chromium || (pause & exit /b 1)
)
echo [2/3] 检查显卡...
node tools\render-gpu.js --check --gl d3d11
if errorlevel 1 (
  echo 自带 Chromium 没拿到显卡，改用系统 Google Chrome 再试...
  node tools\render-gpu.js --check --gl d3d11 --chrome || (echo [警告] 仍是软件渲染，会很慢。见 RENDER-LOCAL.md 常见问题。)
  set EXTRA=--chrome
)
echo [3/3] 渲染全片 1080p60 ...（渲染时不要最小化弹出的浏览器窗口）
node tools\render-gpu.js --gl d3d11 %EXTRA% %*
echo.
echo 完成：out\reel_1080p60.mp4
pause
