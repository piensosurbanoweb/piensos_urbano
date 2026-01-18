# 🐾 Proyecto Piensos Urbano

## 🔹 Descripción
Aplicación **Node.js** para la gestión de pedidos y clientes de la tienda **Piensos Urbano**.  
Desplegada en un servidor **AWS EC2**, con base de datos **MySQL** y edición remota mediante **VS Code Remote – SSH**.

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

1. Abre **VS Code** → **Command Palette** (`Ctrl`+`Shift`+`P`) → escribe `Remote-SSH: Add New SSH Host...`
2. Pega el siguiente comando (ajusta la ruta a tu `.pem` si es diferente y recuerda cambiar `TU_USUARIO`):

```bash
ssh -i "C:\Users\TU_USUARIO\Downloads\piensos_urbano_keys.pem" ubuntu@51.92.72.240
````

3. Guarda en el archivo de configuración que VS Code te propone (generalmente `C:\Users\TU_USUARIO\.ssh\config`).

### 3️⃣ Conectarse al servidor

1. Abre la **Command Palette** (`Ctrl`+`Shift`+`P`).
2. Selecciona `Remote-SSH: Connect to Host...`.
3. Selecciona el host: `ubuntu@51.92.72.240`.

> **Nota:** Espera unos segundos mientras VS Code instala el *VS Code Server* en la instancia EC2. Si es la primera conexión, acepta agregar la clave del host cuando te pregunte.

### 4️⃣ Abrir el proyecto

Una vez conectado (verás el indicador verde en la esquina inferior izquierda):

1. Ve a **File** → **Open Folder**.
2. Escribe la ruta del proyecto en el servidor:

```text
/home/ubuntu/piensos_urbano
````
Haz clic en Open. Ahora el proyecto se abrirá en tu VS Code como si fuera local.

5️⃣ Instalar dependencias (Node.js)
Abre la terminal integrada de VS Code (ya estarás conectado a la EC2) y ejecuta:

```bash
cd /home/ubuntu/piensos_urbano
npm install
````
Esto instalará todas las dependencias de Node.js definidas en el package.json.

6️⃣ Configurar la base de datos
Crea un archivo .env dentro de la raíz del proyecto si no existe:

```bash
nano .env

#Añade la configuración de conexión a MySQL:

Ini, TOML

DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=piensos_urbano
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
