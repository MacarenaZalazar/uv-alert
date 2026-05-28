# Supabase — uv-alert

Pasos manuales para provisionar el proyecto Supabase de uv-alert.

---

## 1. Crear el proyecto

1. Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard) y hacer clic en **New project**.
2. Nombre sugerido: `uv-alert`.
3. Elegir la región más cercana (ej. `us-east-1` para América del Norte, `eu-west-1` para Europa).
4. Ingresar una contraseña segura para la base de datos y **guardarla** — no se vuelve a mostrar.
5. Esperar ~2 minutos hasta que el proyecto quede listo.

---

## 2. Obtener las credenciales

Desde **Settings → API** en el dashboard, copiar:

| Variable de entorno | Dónde encontrarla |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secret) |

> ⚠️ La `SUPABASE_SERVICE_ROLE_KEY` es secreta. NUNCA exponerla al cliente ni incluirla en código que se publique.

---

## 3. Aplicar la migración

### Opción A — Supabase CLI (recomendado)

```bash
# Instalar CLI si no está instalado
npm install -g supabase

# Vincular al proyecto (usar el ref del dashboard, ej. abcdefghijklmnop)
supabase link --project-ref <project-ref>

# Aplicar migración
supabase db push
```

### Opción B — SQL Editor en el dashboard

1. Ir a **SQL Editor** en el dashboard de Supabase.
2. Crear un nuevo snippet.
3. Copiar el contenido de `migrations/0001_init.sql` y ejecutarlo.

---

## 4. Verificar

Ejecutar en el SQL Editor:

```sql
select * from push_subscriptions limit 1;
-- Debe retornar 0 filas sin errores.
```

También verificar que RLS esté habilitado:

```sql
select relname, relrowsecurity
from pg_class
where relname = 'push_subscriptions';
-- relrowsecurity debe ser true.
```

---

## 5. Variables de entorno

Agregar al archivo `.env.local` (o al sistema de secretos del entorno de producción):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

> El proyecto no usa autenticación de usuarios ni clave anon. Todo el acceso a la base de datos ocurre desde el servidor mediante la Service Role key.
