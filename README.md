# 🐾 Piensos Urbano

## 🔹 Descripción

Aplicación **Node.js / Express** para la gestión de pedidos y clientes de la tienda **Piensos Urbano**.

Desplegada en **Vercel** (funciones serverless) con base de datos **PostgreSQL gestionada en Supabase**.

> ⚠️ Este proyecto migró desde AWS EC2 + MySQL. Si encuentras documentación antigua mencionando SSH, `.pem` o EC2, está obsoleta — usa esta guía.

---

## 🔹 Estructura del proyecto

```
piensos_urbano/
├── api/
│   └── index.js        # App Express con todas las rutas (función serverless en Vercel)
├── db/
│   └── schema.sql       # Esquema de la base de datos Postgres (ejecutar una vez en Supabase)
├── public/               # Frontend estático (HTML/CSS/JS)
├── server.js             # Arranque local únicamente (npm start) — no se usa en Vercel
├── vercel.json            # Enruta todas las peticiones a api/index.js
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
```

Esto instalará todas las dependencias de Node.js definidas en el package.json.

6️⃣ Configurar la base de datos
Crea un archivo .env dentro de la raíz del proyecto si no existe:

```bash
nano .env

#Añade la configuración de conexión a MySQL (Copia y pega en .env):
DB_HOST=localhost
DB_USER=piensos_urbano
DB_PASSWORD=Proyecto2025-
DB_NAME=piensos_urbano_db
PORT=3000
```

Para guardar en nano: presiona Ctrl+O, luego Enter, y finalmente Ctrl+X para salir.

7️⃣ Ejecutar la aplicación
Para iniciar el servidor:

```bash
npm start
```

La app debería correr en el servidor. Puedes abrirla en tu navegador (asegúrate de que el puerto 3000 esté abierto en el Security Group de AWS):

```bash
[http://51.92.72.240:3000](http://51.92.72.240:3000)
```
