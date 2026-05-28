# UV Alert

PWA gratuita que te avisa cuando el índice UV en tu zona supera 3 (rayos peligrosos) o vuelve a estar seguro.

Demo: https://uv-alert.vercel.app
Repo: https://github.com/MacarenaZalazar/uv-alert

---

## Para usuarios

### ¿Qué hace?

- Detecta tu ubicación con tu permiso.
- Cada 5 minutos chequea el índice UV de tu zona vía Open-Meteo.
- Te manda una notificación cuando el UV sube a más de 3 ("UV alto") o baja a 3 o menos ("UV seguro").
- Anti-spam: máximo una notificación cada 60 minutos.

### Instalación

#### iOS (iPhone / iPad)

Requiere **iOS 16.4 o superior** y Safari.

1. Abrí https://uv-alert.vercel.app en Safari.
2. Tocá el botón **Compartir** (cuadrado con flecha hacia arriba).
3. Bajá y tocá **Agregar a pantalla de inicio**.
4. Tocá **Agregar** arriba a la derecha.
5. Abrí la app desde el ícono nuevo en tu pantalla de inicio.
6. Tocá **Activar notificaciones** y permití ubicación + notificaciones.

#### Android / Chrome

1. Abrí https://uv-alert.vercel.app
2. Chrome te muestra un banner para instalar la app. Aceptá.
3. Si no aparece: menú ⋮ → **Instalar app**.
4. Activá notificaciones y permitime acceder a tu ubicación.

#### Desktop

1. Abrí https://uv-alert.vercel.app
2. Tocá "Activar notificaciones".
3. Permití notificaciones + ubicación cuando el navegador te pregunte.

### FAQ

- **¿Es gratis?** Sí, 100% gratis. No requiere cuenta.
- **¿Qué datos guardás?** Solo tu ubicación (lat/lon) y el endpoint anónimo de tu navegador para mandarte la notificación. Sin email, sin nombre, sin tracking.
- **¿Por qué no me llega la notificación?**
  - Chequeá que las notificaciones estén activadas en el sistema.
  - En iOS: la app debe estar instalada en pantalla de inicio (no funciona desde Safari).
  - Modo "No molestar" del sistema bloquea las notificaciones.
- **¿Puedo cambiar el umbral de 3?** Por ahora no. Próxima versión.
- **¿Y si cambio de ciudad?** Re-activá las notificaciones desde la app; se actualiza la ubicación.

---

## For developers

### Stack

- Next.js 15 (App Router) + TypeScript strict
- TailwindCSS 3
- Supabase (free tier) — push_subscriptions table
- web-push (VAPID) — server-side push delivery
- Open-Meteo (free, no key) — UV index data
- Vercel (Hobby tier) — deploy
- GitHub Actions — cron trigger every 5 min

### Local setup

```bash
git clone https://github.com/MacarenaZalazar/uv-alert.git
cd uv-alert
npm install
cp .env.example .env.local
```

### Generate VAPID keys

```bash
npm run vapid:gen
# Copy NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY into .env.local
# Set VAPID_SUBJECT=mailto:your@email.com
```

NEVER commit the VAPID private key.

### Supabase setup

1. Create a free project at https://supabase.com/dashboard.
2. Apply the migration in `supabase/migrations/0001_init.sql` via the SQL editor.
3. Copy `Project URL` → `SUPABASE_URL` and `Service Role Key` → `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.

### Generate CRON_SECRET

```bash
openssl rand -hex 32
# Copy to CRON_SECRET in .env.local
```

### Run locally

```bash
npm run dev
# http://localhost:3000
```

### Tests + checks

```bash
npm run lint
npm run typecheck
npm run test
```

### Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link + deploy
vercel link
vercel
vercel --prod
```

Or push to `main` and let Vercel's git integration auto-deploy.

#### Env vars on Vercel

Project Settings → Environment Variables. Set for all environments (Production, Preview, Development):

| Variable | Type | Value |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Plain | from `npm run vapid:gen` |
| `VAPID_PRIVATE_KEY` | Encrypted | from `npm run vapid:gen` |
| `VAPID_SUBJECT` | Plain | `mailto:your@email.com` |
| `CRON_SECRET` | Encrypted | from `openssl rand -hex 32` |
| `SUPABASE_URL` | Plain | from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Encrypted | from Supabase Settings → API |

### GitHub Actions cron

`.github/workflows/uv-check.yml` runs `*/5 * * * *` and POSTs to `/api/uv-check`.

Required GitHub repo secrets (Settings → Secrets and variables → Actions):
- `VERCEL_UV_CHECK_URL` — e.g. `https://uv-alert.vercel.app/api/uv-check`
- `CRON_SECRET` — same value as Vercel's `CRON_SECRET`

Cron jitter: GitHub Actions schedules can drift 5–15 min during peak hours. Acceptable for UV (slow-changing).

### Architecture

```
Browser
    ↓ (PushManager subscribe)
/api/subscribe → Supabase.push_subscriptions

GitHub Actions */5 min
    ↓ POST (Bearer CRON_SECRET)
/api/uv-check
    1. List subs from Supabase
    2. Group by 0.1° lat/lon grid (dedup)
    3. fetch Open-Meteo per grid cell
    4. evaluate lib/uvRules.shouldNotify per sub
    5. sendPush via lib/webPush
    6. Update last_uv / last_notified_at / last_polled_at
    7. Delete subs on 410/404 (gone)
```

### License

MIT
