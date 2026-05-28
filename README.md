# uv-alert

PWA que notifica cambios del índice UV (umbral 3).

Setup completo en task #18.

## Cron setup

GitHub Actions runs `.github/workflows/uv-check.yml` every 5 min and POSTs to the Vercel `/api/uv-check` endpoint.

Required GitHub repo secrets (Settings → Secrets and variables → Actions):
- `VERCEL_UV_CHECK_URL` — full URL, e.g. `https://uv-alert.vercel.app/api/uv-check`
- `CRON_SECRET` — same value as Vercel project's `CRON_SECRET` env var
