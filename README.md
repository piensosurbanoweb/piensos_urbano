# 🐾 Proyecto Piensos Urbano

## 🔹 Descripción
Aplicación **Node.js / Express** para la gestión de pedidos y clientes de la tienda **Piensos Urbano**.

Desplegada en **Vercel** (usando su soporte "zero-config" para Express) con base de datos **PostgreSQL gestionada en Supabase**.

> ⚠️ Este proyecto migró desde AWS EC2 + MySQL. Si encuentras documentación antigua mencionando SSH, `.pem` o EC2, está obsoleta — usa esta guía.

---

## 🔹 Estructura del proyecto

```
piensos_urbano/
├── db/
│   └── schema.sql       # Esquema de la base de datos Postgres (ejecutar una vez en Supabase)
├── public/               # Frontend estático (HTML/CSS/JS)
├── server.js              # App Express completa. Vercel la detecta automáticamente
│                          # (zero-config Express) y también sirve para "npm start" en local
├── api/index.js           # OBSOLETO, ya no se usa (se deja vacío para no romper enlaces)
├── vercel.json            # Vacío intencionadamente — no hace falta configuración extra
└── .env.example           # Plantilla de variables de entorno
```

---

## 🔹 1. Crear la base de datos en Supabase

1. Entra en [supabase.com](https://supabase.com) e inicia sesión con la cuenta del proyecto.
2. Crea un nuevo proyecto (elige una región cercana, p. ej. Europa).
3. Ve a **SQL Editor** y pega el contenido de `db/schema.sql`. Ejecútalo — esto crea todas las tablas vacías (clientes, pedidos, pedidos_historial, pedidos_pendientes, pedidos_calendario, pedidos_hoja_reparto, usuarios, conductores, camiones, zonas).
4. Ve a **Project Settings → Database → Connection string → URI** y copia la cadena de conexión. Usa el modo **Transaction pooler** (puerto `6543`), recomendado para funciones serverless.

---

## 🔹 2. Desarrollo local

```bash
npm install
cp .env.example .env
# Edita .env y pega tu DATABASE_URL de Supabase y genera un JWT_SECRET (ver abajo)
npm start
```

La app corre en `http://localhost:3000`.

---

## 🔹 3. Desplegar en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión (puedes usar tu cuenta de GitHub).
2. **Add New → Project** y selecciona el repositorio `piensos_urbano`.
3. Vercel detecta Node.js automáticamente. No hace falta configurar build command (no hay paso de build).
4. En **Environment Variables**, añade:
   - `DATABASE_URL` → la cadena de conexión de Supabase del paso 1.
   - `JWT_SECRET` → una clave aleatoria larga (ver sección de variables de entorno más abajo).
5. Despliega. A partir de aquí, cada `git push` a la rama principal despliega automáticamente (no hace falta ninguna GitHub Action ni claves SSH).

El archivo `.github/workflows/deploy.yml` del despliegue antiguo a EC2 ya no se usa — puedes eliminarlo cuando quieras.

---

## 🔹 4. Variables de entorno

| Variable       | Dónde se define                          | Descripción                                  |
|----------------|-------------------------------------------|-----------------------------------------------|
| `DATABASE_URL` | `.env` (local) / Vercel Environment Vars  | Cadena de conexión Postgres de Supabase       |
| `JWT_SECRET`   | `.env` (local) / Vercel Environment Vars  | Clave para firmar las sesiones de login. Genera una con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y no la compartas. |
| `PORT`         | `.env` (local, opcional)                  | Puerto local, por defecto 3000                |

**Nunca** subas el archivo `.env` ni credenciales reales a este repositorio (`.env` ya está en `.gitignore`).

---

## 🔹 5. Acceso con usuario y contraseña

Desde esta versión, la app pide iniciar sesión (usuario + contraseña) para poder ver o tocar cualquier dato — antes cualquiera con el enlace podía entrar. Cada persona debería tener su propio usuario; se gestionan desde la pestaña **Gestión BD → Usuarios con Acceso** una vez dentro.

Para crear el **primer usuario** (huevo y gallina: hace falta estar dentro para crear usuarios desde la app, así que el primero se crea directamente en Supabase):

1. Ve a **SQL Editor** en Supabase y ejecuta primero, una sola vez:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
2. Luego ejecuta esto, cambiando el usuario, el nombre, el email y la contraseña por los tuyos (la contraseña la escribes tú aquí mismo, en tu propia consola de Supabase — no pasa por ningún otro sitio). Tu primer usuario debe quedar como `propietario`:
   ```sql
   INSERT INTO usuarios (nombre_usuario, nombre, email, password_hash, rol)
   VALUES ('paula', 'Paula', 'tu-email@ejemplo.com', crypt('TU_CONTRASEÑA_AQUI', gen_salt('bf')), 'propietario');
   ```
3. Ya puedes entrar en la app con ese usuario y esa contraseña. Desde **Gestión BD → Usuarios con Acceso** puedes añadir el resto de personas que necesiten entrar, sin volver a tocar SQL.

### Si ya tenías la tabla `usuarios` creada antes de esta actualización

Ejecuta esto una sola vez en el SQL Editor de Supabase para añadir las columnas nuevas (email, rol y recuperación de contraseña) sin perder los usuarios que ya tengas:

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(150) UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'gestor';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ;

-- Pon tu usuario existente como propietario (cambia 'paula' por tu nombre_usuario real):
UPDATE usuarios SET rol = 'propietario' WHERE nombre_usuario = 'paula';

-- Ponle un email a cada usuario existente para que puedan recuperar su contraseña
-- (si no, tendrán que pedirte a ti que se la cambies desde Usuarios con Acceso):
UPDATE usuarios SET email = 'email-de-esa-persona@ejemplo.com' WHERE nombre_usuario = 'nombre_usuario_de_esa_persona';
```

### Roles

Hay tres niveles, de más a menos permisos:

| Rol | Quién es | Qué puede gestionar |
|---|---|---|
| **Desarrollador** (superadmin) | quien mantiene técnicamente la app | Todo, incluido crear/editar/desactivar propietarios y otros desarrolladores. |
| **Propietario** (admin) | la dueña del negocio | Todo el uso normal de la app, y puede crear/editar/desactivar gestores y otros propietarios — pero **nunca** puede tocar una cuenta de desarrollador. |
| **Gestor autorizado** | personal de confianza | Usa toda la app exactamente igual que el propietario (clientes, pedidos, calendario, hoja de reparto...), pero no ve ni puede tocar la gestión de usuarios/roles. |

No hay ningún usuario "desarrollador" por defecto: si en algún momento quien mantiene la app técnicamente necesita su propia cuenta de ese tipo, se crea igual que el primer usuario (paso 1-2 de arriba), poniendo `'desarrollador'` en vez de `'propietario'`.

### Recuperar / cambiar contraseña

- **Cambiar tu propia contraseña estando ya dentro:** icono redondo arriba a la derecha → "Cambiar contraseña".
- **Olvidaste la contraseña:** en el login, enlace "¿Olvidaste tu contraseña?" → escribe tu usuario o email → te llega un correo con un enlace válido durante 1 hora. Para que esto funcione hace falta configurar el envío de emails (siguiente apartado); si no está configurado, un propietario o desarrollador puede simplemente crearte una contraseña nueva desde Gestión BD → Usuarios con Acceso.

### Configurar el envío de emails (Resend)

El correo de "recuperar contraseña" se envía con [Resend](https://resend.com), un servicio de email con plan gratuito de sobra para esta app:

1. Crea una cuenta gratuita en [resend.com](https://resend.com).
2. En su panel, ve a **API Keys** y crea una nueva clave.
3. Añádela como variable de entorno `RESEND_API_KEY` tanto en tu `.env` local como en Vercel (Project Settings → Environment Variables), y vuelve a desplegar.

Sin dominio propio verificado en Resend, los correos se envían desde una dirección genérica (`onboarding@resend.dev`) — funciona igual, pero si más adelante quieres que lleguen como `algo@piensosycerealesurbano.com`, hay que verificar ese dominio en Resend (añadiendo unos registros DNS) y decírmelo para actualizar el remitente en el código.

---

## 🔹 Notas de la migración (MySQL → Postgres)

- Los placeholders de las consultas cambiaron de `?` (MySQL) a `$1, $2, ...` (Postgres).
- `INSERT IGNORE` se sustituyó por `INSERT ... ON CONFLICT DO NOTHING`.
- Las funciones `SUBSTRING_INDEX` de MySQL para extraer `cantidad`/`producto` del campo `descripcion` ahora se calculan en JavaScript (función `parseDescripcion` en `server.js`), no en SQL.
- `result.insertId` se sustituyó por `RETURNING id` en los `INSERT`.
- Es un esquema **nuevo y vacío** (no se migraron los datos históricos de la base MySQL del EC2). Si necesitas ese histórico más adelante, hay que exportarlo desde el EC2 y convertirlo al nuevo esquema.
