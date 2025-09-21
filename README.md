# Conexión a la base de datos `piensosurbano-db` en Render

Este documento explica cómo instalar el cliente de PostgreSQL y conectarse a la base de datos **piensosurbano-db** alojada en [Render](https://render.com), en distintos sistemas operativos.

---

## Datos de conexión de Render

- **Host:** `dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com`
- **Puerto:** `5432`
- **Base de datos:** `piensosurbano_db`
- **Usuario:** `piensosurbano_db_user`
- **Contraseña:** `1XHe24nwUm90KH3NfjAezbTagdzXZVOI`

---

## 🔹 Ubuntu / WSL (Windows Subsystem for Linux)

1. Actualizar los repositorios:
   ```bash
   sudo apt update
   ```

2. Instalar el cliente de PostgreSQL:
   ```bash
   sudo apt install postgresql-client -y
   ```

3. Verificar la instalación:
   ```bash
   psql --version
   ```

4. Conectarse a la base de datos:
   ```bash
   PGPASSWORD="1XHe24nwUm90KH3NfjAezbTagdzXZVOI" psql -h dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com -U piensosurbano_db_user -d piensosurbano_db -p 5432
   ```

5. Contraseña base de datos:
   ```bash
   1XHe24nwUm90KH3NfjAezbTagdzXZVOI
   ```
6. Salir de la consola de PostgreSQL. Dentro de `psql`, puedes salir con:

```sql
\q
```
---

## 🔹 Windows (CMD o PowerShell)

1. Descargar e instalar [PostgreSQL Client](https://www.postgresql.org/download/windows/).  
   ⚠️ Asegúrate de marcar la opción **Command Line Tools** en el instalador.

2. Abrir **PowerShell** y establecer la variable de entorno para la contraseña:
   ```powershell
   $env:PGPASSWORD="1XHe24nwUm90KH3NfjAezbTagdzXZVOI"
   ```

3. Conectarse a la base de datos:
   ```powershell
   psql -h dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com -U piensosurbano_db_user -d piensosurbano_db -p 5432
   ```

---

## 🔹 macOS (Homebrew)

1. Instalar PostgreSQL Client con Homebrew:
   ```bash
   brew install postgresql
   ```

2. Verificar la instalación:
   ```bash
   psql --version
   ```

3. Conectarse a la base de datos:
   ```bash
   PGPASSWORD="1XHe24nwUm90KH3NfjAezbTagdzXZVOI" psql -h dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com -U piensosurbano_db_user -d piensosurbano_db -p 5432
   ```

---
## Verifica que todo se creó:

 ```bash
   \dt
   ```

Y deberías ver las tablas:

 ```bash
piensosurbano_db=> \dt
                      List of relations
 Schema |        Name        | Type  |         Owner
--------+--------------------+-------+-----------------------
 public | camiones           | table | piensosurbano_db_user
 public | clientes           | table | piensosurbano_db_user
 public | conductores        | table | piensosurbano_db_user
 public | pedidos_calendario | table | piensosurbano_db_user
 public | pedidos_historial  | table | piensosurbano_db_user
 public | pedidos_pendientes | table | piensosurbano_db_user
 public | zonas              | table | piensosurbano_db_user
(7 rows)
 ```
---

## ✅ Notas

- Nunca compartas la contraseña de la base de datos en repositorios públicos.
- Si quieres ejecutar un script `.sql`, usa:
  ```bash
  \i ruta/a/tu/script.sql
  ```
  
  dentro de la sesión de `psql`.

---

## 🚀 Despliegue en Render

Esta sección explica cómo desplegar el servidor Node.js (`server.js`) en [Render](https://render.com/) usando PostgreSQL.

### 1️⃣ Configuración del proyecto
- En tu terminal local, ejecuta:

```bash

npm install
```

Para subir a Render:
```bash
git add .
git commit -m "Prepara deploy para Render"
git push origin main
```

⚠️ Si hay errores de push por permisos (403) o diferencias con el repositorio remoto, primero haz:
```bash
git pull origin main --rebase
```
