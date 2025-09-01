@echo off
echo Deploying Promo Code Manager to Cloudflare Workers...

echo.
echo [1/2] Building application...
call build.bat

echo.
echo [2/2] Deploying to Cloudflare...
npx wrangler deploy --env production

echo.
echo ✅ Deployment completed!
echo.
echo Your app should be available at:
echo   https://promo-code-manager-prod.your-account.workers.dev
echo.
pause