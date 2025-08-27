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
5. Salir de la consola de PostgreSQL. Dentro de `psql`, puedes salir con:

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
## Una vez dentro, puedes pegar tu script entero (mejor de tabla en tabla):

```bash
SCRIPT BASE DE DATOS PIENSOSURBANO

CREATE TABLE clientes (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apodo VARCHAR(100) NOT NULL UNIQUE,
    nombre_completo VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    localidad VARCHAR(100) NOT NULL,
    zona_reparto VARCHAR(50) NOT NULL,
    observaciones TEXT
);

CREATE TABLE pedidos_historial (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id INT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_pedido DATE NOT NULL,
    fecha_entrega DATE NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE pedidos_pendientes (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    historial_id INT NOT NULL,
    cliente_id INT NOT NULL,
    apodo VARCHAR(100) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    localidad VARCHAR(100) NOT NULL,
    zona VARCHAR(50) NOT NULL,
    pedido TEXT NOT NULL,
    fecha_programacion DATE NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (historial_id) REFERENCES pedidos_historial(id) ON DELETE CASCADE
);


CREATE TABLE pedidos_calendario (
    id SERIAL PRIMARY KEY,  -- mejor un ID autoincremental en lugar de VARCHAR
    historial_id INT NOT NULL,
    cliente_id INT,
    dia_reparto TEXT CHECK (dia_reparto IN ('lunes', 'martes', 'miercoles', 'jueves', 'viernes')) NOT NULL,
    fecha_reparto DATE NOT NULL,   -- 📌 Nueva columna: permite repetir el mismo pedido en distintas fechas
    orden_reparto INT DEFAULT 1,
    conductor VARCHAR(100) DEFAULT 'Sin asignar',
    camion VARCHAR(100) DEFAULT 'Sin asignar',
    observaciones TEXT,
    enviado_reparto BOOLEAN DEFAULT FALSE,
    fecha_envio_reparto DATE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (historial_id) REFERENCES pedidos_historial(id) ON DELETE CASCADE
);


CREATE TABLE conductores (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE camiones (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE zonas (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

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
