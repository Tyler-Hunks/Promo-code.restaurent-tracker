@echo off
echo Building Promo Code Manager for production...

echo.
echo [1/3] Cleaning previous build...
if exist dist rmdir /s /q dist

echo.
echo [2/3] Building frontend...
npx vite build --config vite.config.production.ts

echo.
echo [3/3] Building Cloudflare Worker...
npx esbuild server/worker.ts --platform=browser --format=esm --bundle --outfile=dist/worker.js --external:node:* --define:process.env.NODE_ENV=\"production\" --minify

echo.
echo ✅ Build completed successfully!
echo.
echo Files ready for deployment:
echo   - dist/worker.js (Cloudflare Worker)
echo   - dist/public/ (Static assets)
echo.
echo To deploy: wrangler deploy --env production
pause