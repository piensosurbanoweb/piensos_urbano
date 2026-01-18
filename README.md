# 🐾 Proyecto Piensos Urbano

## 🔹 Descripción
Aplicación **Node.js** para la gestión de pedidos y clientes de la tienda **Piensos Urbano**.  
Desplegada en un servidor **AWS EC2**, con base de datos **MySQL** y edición remota mediante **VS Code Remote – SSH**.

---

## 🔹 Requisitos para acceder al servidor
* **Visual Studio Code**
* Extensión: **Remote – SSH**
* Clave \`.pem\` para conexión segura (\`~/.ssh/piensosurbano-key.pem\`)
* **Node.js y npm** (instalados en el servidor)

---

## Conexión al servidor y trabajo en el proyecto

Sigue estos pasos para conectarte al servidor EC2 y trabajar con el proyecto **piensos_urbano**.

---

### 1️⃣ Requisitos previos

- Tener **VS Code** instalado en tu ordenador.
- Instalar la extensión **Remote - SSH** en VS Code.
- Tener la clave privada `.pem` para la instancia (`piensos_urbano_keys.pem`).
- Conexión a internet.

---

### 2️⃣ Configurar la conexión SSH en VS Code

1. Abre **VS Code** → **Command Palette** (Ctrl+Shift+P) → `Remote-SSH: Add New SSH Host...`
2. Pega este comando (ajusta la ruta a tu `.pem` si es diferente):

```bash
ssh -i "C:\Users\TU_USUARIO\Downloads\piensos_urbano_keys.pem" ubuntu@51.92.72.240
