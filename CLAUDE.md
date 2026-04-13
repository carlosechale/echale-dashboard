# Échale Dashboard

Panel de gestión para una agencia de marketing/diseño. Tiene dos roles diferenciados: **admin** (equipo interno) y **client** (clientes de la agencia), cada uno con su propio dashboard y sección de navegación.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS |
| Auth & DB | Supabase (`@supabase/supabase-js` + `@supabase/ssr`) |
| Fuentes | Syne (display/headings) · DM Sans (body) |

---

## Estructura de carpetas

```
app/
  (auth)/
    login/
      page.tsx        — Página de login pública
      LoginForm.tsx   — Formulario interactivo (Client Component)
    layout.tsx        — Layout sin sidebar
  (admin)/
    dashboard/
      page.tsx        — Panel de agencia (rol admin)
    layout.tsx        — Layout con Sidebar admin
  (client)/
    dashboard/
      page.tsx        — Panel de cliente (rol client)
    layout.tsx        — Layout con Sidebar client
  api/
    auth/
      login/route.ts  — POST /api/auth/login
      logout/route.ts — POST /api/auth/logout
  layout.tsx          — Root layout (fuentes, globals)
  globals.css         — Variables CSS y Tailwind base
  page.tsx            — Redirect a /login

components/
  ui/
    Sidebar.tsx       — Sidebar reutilizable (acepta role prop)

lib/
  supabase/
    server.ts         — Cliente Supabase para Server Components / API routes
    client.ts         — Cliente Supabase para Client Components

types/
  index.ts            — Tipos compartidos (UserRole, Profile)

middleware.ts         — Protección de rutas + refresh de sesión
```

---

## Design system

### Colores (Tailwind)

| Token | Valor | Uso |
|---|---|---|
| `background` | `#080808` | Fondo global |
| `surface` | `#111111` | Cards, sidebar |
| `border` | `#1F1F1F` | Bordes, separadores |
| `foreground` | `#F5F5F5` | Texto principal |
| `muted` | `#6B6B6B` | Texto secundario, placeholders |
| `accent` | `#C8FF00` | CTA, activo, highlights |
| `accent-dim` | `#A3D000` | Hover del acento |

### Fuentes

- `font-display` → Syne — titulares, brand, botones CTA
- `font-sans` → DM Sans — párrafos, labels, UI

### Utilidades extra

- `.accent-glow` — sombra verde grande (para cards hero)
- `.accent-glow-sm` — sombra verde suave (para botones)

---

## Autenticación

El flujo usa Supabase Auth con cookies SSR:

1. `POST /api/auth/login` — llama a `supabase.auth.signInWithPassword`, lee el rol de la tabla `profiles` y devuelve `{ role }`.
2. El cliente redirige a `/dashboard` según el rol.
3. `middleware.ts` protege todas las rutas: redirige a `/login` si no hay sesión, y de `/login` a `/dashboard` si ya la hay.
4. `POST /api/auth/logout` — llama a `supabase.auth.signOut`.

### Tabla `profiles` en Supabase

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz default now()
);

-- Trigger para crear perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## Variables de entorno

Copia `.env.local` y rellena con tus valores de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## Comandos

```bash
npm run dev      # Servidor de desarrollo en localhost:3000
npm run build    # Build de producción
npm run start    # Servidor de producción
```

---

## Convenciones

- Los **Server Components** son el default. Usar `"use client"` solo cuando se necesite estado, eventos o hooks de browser.
- Los clientes de Supabase están separados: `lib/supabase/server.ts` para el servidor, `lib/supabase/client.ts` para el cliente.
- Tailwind primero — no crear clases CSS custom si Tailwind lo puede resolver.
- Componentes en `components/ui/` solo si se reutilizan en más de un lugar.
