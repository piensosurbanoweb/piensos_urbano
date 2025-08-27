# 📘 Guía de instalación y conexión a PostgreSQL en WSL (Ubuntu 24.04)

Este documento explica cómo instalar el cliente de PostgreSQL en **Windows con WSL (Ubuntu 24.04)** y conectarse a una base de datos alojada en **Render**.

---

## 1. Abrir Ubuntu (WSL)
En Windows, abre una terminal de Ubuntu (WSL):

```powershell
wsl
```

---

## 2. Actualizar paquetes
Ejecuta en Ubuntu:

```bash
sudo apt update
```

---

## 3. Instalar cliente de PostgreSQL
Instala el cliente (necesario para usar `psql`):

```bash
sudo apt install postgresql-client -y
```

---

## 4. Verificar instalación
Comprueba que el cliente se instaló correctamente:

```bash
psql --version
```

Deberías ver algo como:

```
psql (PostgreSQL) 16.x
```

---

## 5. Conexión a la base de datos en Render
Con las credenciales de Render, conéctate a tu base de datos:

```bash
PGPASSWORD="TU_PASSWORD" psql \
  -h dpg-XXXXX.frankfurt-postgres.render.com \
  -U TU_USUARIO \
  -d TU_BASE_DE_DATOS \
  -p 5432
```

Ejemplo real para `piensosurbano-db`:

```bash
PGPASSWORD="1XHe24nwUm90KH3NfjAezbTagdzXZVOI" psql \
  -h dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com \
  -U piensosurbano_db_user \
  -d piensosurbano_db \
  -p 5432
```

---

## 6. Ejecutar scripts `.sql`
Para ejecutar un archivo `.sql` con tus tablas y datos (Ejemplo para piensosurbano-db) :

```bash
 PGPASSWORD="1XHe24nwUm90KH3NfjAezbTagdzXZVOI" psql \
  -h dpg-d2mr240gjchc73d0nivg-a.frankfurt-postgres.render.com \
  -U piensosurbano_db_user \
  -d piensosurbano_db \
  -p 5432
```

---

## 7. Salir de la consola de PostgreSQL
Dentro de `psql`, puedes salir con:

```sql
\q
```

---

✅ Con esto ya tienes PostgreSQL listo en WSL y conectado a Render.
