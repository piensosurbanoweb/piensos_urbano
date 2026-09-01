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
3. Ve a **SQL Editor** y pega el contenido de `db/schema.sql`. Ejecútalo — esto crea todas las tablas vacías (clientes, pedidos, pedidos_historial, pedidos_pendientes, pedidos_calendario, pedidos_hoja_reparto, conductores, camiones, zonas).
4. Ve a **Project Settings → Database → Connection string → URI** y copia la cadena de conexión. Usa el modo **Transaction pooler** (puerto `6543`), recomendado para funciones serverless.

---

## 🔹 2. Desarrollo local

```bash
npm install
cp .env.example .env
# Edita .env y pega tu DATABASE_URL de Supabase
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
5. Despliega. A partir de aquí, cada `git push` a la rama principal despliega automáticamente (no hace falta ninguna GitHub Action ni claves SSH).

El archivo `.github/workflows/deploy.yml` del despliegue antiguo a EC2 ya no se usa — puedes eliminarlo cuando quieras.

---

## 🔹 4. Variables de entorno

| Variable       | Dónde se define                          | Descripción                                  |
|----------------|-------------------------------------------|-----------------------------------------------|
| `DATABASE_URL` | `.env` (local) / Vercel Environment Vars  | Cadena de conexión Postgres de Supabase       |
| `PORT`         | `.env` (local, opcional)                  | Puerto local, por defecto 3000                |

**Nunca** subas el archivo `.env` ni credenciales reales a este repositorio (`.env` ya está en `.gitignore`).

---

## 🔹 Notas de la migración (MySQL → Postgres)

- Los placeholders de las consultas cambiaron de `?` (MySQL) a `$1, $2, ...` (Postgres).
- `INSERT IGNORE` se sustituyó por `INSERT ... ON CONFLICT DO NOTHING`.
- Las funciones `SUBSTRING_INDEX` de MySQL para extraer `cantidad`/`producto` del campo `descripcion` ahora se calculan en JavaScript (función `parseDescripcion` en `server.js`), no en SQL.
- `result.insertId` se sustituyó por `RETURNING id` en los `INSERT`.
- Es un esquema **nuevo y vacío** (no se migraron los datos históricos de la base MySQL del EC2). Si necesitas ese histórico más adelante, hay que exportarlo desde el EC2 y convertirlo al nuevo esquema.
