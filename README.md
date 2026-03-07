# 🐾 Piensos Urbano

> Aplicación **Node.js** para la gestión integral de pedidos y clientes de la tienda **Piensos Urbano**.  
> Desplegada en **AWS EC2** con base de datos **MySQL**, proceso gestionado por **PM2** y despliegue automático con **GitHub Actions**.

---

## 🏗️ Arquitectura

| Componente | Detalle |
|---|---|
| Servidor | AWS EC2 — Ubuntu 24.04 (región eu-south-2) |
| Base de datos | MySQL Server (instalado localmente en la EC2) |
| Gestor de procesos | PM2 — mantiene la API activa 24/7 |
| Entorno | Node.js v20+ |
| CI/CD | GitHub Actions — auto-deploy en cada push a `main` |

---

## ☁️ Acceso a AWS EC2

1. Ve a [https://signin.aws.amazon.com](https://signin.aws.amazon.com) y selecciona **Root User**
2. **Correo:** `piensosurbanoweb@gmail.com`
3. **Contraseña:** `Proyecto2025-`
4. Se pedirá un código de **Google Authenticator** — consulta a Paula para configurarlo en tu móvil

> ⚠️ **Nunca compartas estas credenciales fuera del equipo.**

---

## 🛠️ Puesta en marcha local

**1. Clona el repositorio:**
```bash
git clone https://github.com/piensosurbanoweb/piensos_urbano.git
cd piensos_urbano
```

**2. Instala las dependencias:**
```bash
npm install
```

**3. Crea el archivo `.env` en la raíz** (pide las credenciales a Paula):
```env
DB_HOST=127.0.0.1
DB_USER=piensos_user
DB_PASSWORD=********
DB_NAME=piensos_urbano
PORT=3000
```

> El archivo `.env` está en `.gitignore` y **nunca se sube al repositorio**.

---

## 🔐 Conexión SSH al Servidor

Necesitas el archivo de clave privada `.pem` (pídelo a Paula).

```bash
ssh -i "piensos_urbano_keys.pem" ubuntu@51.48.60.111
```

El proyecto está en:
```bash
cd ~/piensos_urbano
```

> 💡 También puedes usar **VS Code Remote – SSH** para editar archivos directamente en el servidor con interfaz gráfica.

---

## 🔄 Flujo de Despliegue Automático (CI/CD)

No hace falta entrar al servidor para actualizar el código. El pipeline es automático:

```
git add .
git commit -m "descripción del cambio"
git push origin main
```

GitHub Actions se encarga de:
1. Conectarse por SSH al servidor AWS
2. Ejecutar `git pull origin main`
3. Ejecutar `npm install`
4. Reiniciar el servicio con `pm2 restart piensos-api`

Puedes ver el estado del despliegue en la pestaña **[Actions](https://github.com/piensosurbanoweb/piensos_urbano/actions)** del repositorio. ✅ verde = todo correcto.

---

## 📊 Comandos Útiles en el Servidor

Una vez dentro por SSH:

| Comando | Para qué sirve |
|---|---|
| `pm2 status` | Ver si la API está corriendo |
| `pm2 logs piensos-api` | Ver logs en tiempo real |
| `pm2 logs piensos-api --lines 50` | Ver las últimas 50 líneas de logs |
| `pm2 restart piensos-api` | Reiniciar la API manualmente |
| `pm2 reload piensos-api` | Reiniciar sin cortar conexiones activas |
| `sudo systemctl status mysql` | Ver si MySQL está activo |
| `mysql -u piensos_user -p piensos_urbano` | Entrar a la base de datos |
| `git pull origin main` | Traer últimos cambios (manual) |
| `git log --oneline -5` | Ver los últimos 5 commits |

---

## 🗄️ Estructura de la Base de Datos

Base de datos: `piensos_urbano` en MySQL.

| Tabla | Descripción |
|---|---|
| `clientes` | Datos de cada cliente (apodo, nombre, teléfono, localidad, zona, observaciones) |
| `pedidos` | Registro de pedidos realizados |
| `pedidos_historial` | Historial completo de pedidos por cliente |
| `pedidos_pendientes` | Pedidos sin fecha de reparto asignada aún |
| `pedidos_calendario` | Pedidos programados con fecha y día de reparto |
| `conductores` | Conductores disponibles para el reparto |
| `camiones` | Vehículos disponibles |
| `zonas` | Zonas de reparto configuradas |

Para modificar la estructura (añadir columnas, etc.):
```bash
mysql -u piensos_user -p piensos_urbano
```

---

## 🔗 Endpoints de la API

La API es accesible en: **`http://51.48.60.111:3000/`** pero hay que revisar en EC2 si es 51.48.60.111 u otra IP pública, o si ha cambiado

### Clientes
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/clientes` | Listado de todos los clientes |
| `POST` | `/clientes` | Crear nuevo cliente |
| `PUT` | `/clientes/:id` | Editar cliente existente |
| `DELETE` | `/clientes/:id` | Eliminar cliente |

### Pedidos
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/pedidos` | Registrar nuevo pedido (crea historial y pendiente) |
| `GET` | `/pedidos/pendientes` | Pedidos pendientes de programar |
| `POST` | `/pedidos/programar-con-fecha/:id` | Mover pendiente al calendario con fecha |
| `GET` | `/pedidos_calendario` | Pedidos del calendario (semana por `offset`) |
| `GET` | `/pedidos/diarios/:dia` | Pedidos de un día concreto |
| `PATCH` | `/pedidos/editar-fecha/:id` | Cambiar fecha de un pedido en calendario |
| `DELETE` | `/pedidos_pendientes/:id` | Eliminar pedido pendiente |

### Hoja de Reparto
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/pedidos/hoja-reparto` | Pedidos en la hoja de reparto activa |
| `POST` | `/pedidos/hoja-reparto` | Añadir pedidos a la hoja de reparto |

### Gestión
| Método | Ruta | Descripción |
|---|---|---|
| `GET` / `POST` / `DELETE` | `/conductores` | Gestión de conductores |
| `GET` / `POST` / `DELETE` | `/camiones` | Gestión de camiones |
| `GET` / `POST` / `DELETE` | `/zonas` | Gestión de zonas de reparto |

---

*Cualquier duda, consulta a Paula 🐾*
