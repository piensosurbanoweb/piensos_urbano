# 🐾 Proyecto Piensos Urbano

## 🔹 Descripción
Aplicación **Node.js** para la gestión de pedidos y clientes de la tienda **Piensos Urbano**.  
Desplegada en un servidor **AWS EC2**, con base de datos **MySQL** y edición remota mediante **VS Code Remote – SSH**.

---

## 🔹 AWS EC2
Para acceder a AWS EC2 entra en https://signin.aws.amazon.com/signin?redirect_uri=https%3A%2F%2Feu-south-2.console.aws.amazon.com%2Fec2%2Fhome%3Fca-oauth-flow-id%3D0202%26hashArgs%3D%2523Instances%253A%26isauthcode%3Dtrue%26oauthStart%3D1768775671914%26region%3Deu-south-2%26state%3DhashArgsFromTB_eu-south-2_bd0fe12835f2737e&client_id=arn%3Aaws%3Asignin%3A%3A%3Aconsole%2Fec2-tb&forceMobileApp=0&code_challenge=K5e0TRasumHXYa8LrZ1PQeae45IzVS69zq4oSNSt-Vo&code_challenge_method=SHA-256 e inicia sesion con un email raiz con Root User

CORREO: piensosurbanoweb@gmail.com
CONTRASEÑA: Proyecto2025-

*Tienes que configurar un modo de acceso con la app en el móvil de Google Authenticator (Pregunta esta parte a Paula sino te enteras)*

---

## Conexión al servidor y trabajo en el proyecto

Sigue estos pasos para conectarte al servidor EC2 y trabajar con el proyecto **piensos_urbano**.

---
### 1️⃣ Requisitos previos

- Tener **VS Code** instalado en tu ordenador.
- Instalar la extensión **Remote - SSH** en VS Code.
- Tener la clave privada `.pem` para la instancia (`piensos_urbano_keys.pem`). Clave necesaria debes tener descargada en Descargas para poder hacer los pasos siguientes. La puedes encontrar en el repositorio.
---

### 2️⃣ Configurar la conexión SSH en VS Code

1. Abre **VS Code** → **Command Palette** (`Ctrl`+`Shift`+`P`) → escribe `Remote-SSH: Add New SSH Host...`
2. Pega el siguiente comando (ajusta la ruta a tu `.pem` si es diferente y recuerda cambiar `TU_USUARIO`):

```bash
ssh -i "C:\Users\TU_USUARIO\Downloads\piensos_urbano_keys.pem" ubuntu@51.92.72.240
````

### 2️⃣B Configurar la conexión SSH desde PowerShell

1. Abre una terminal en **Powershell** y comprueba que tienes el archivo **piensos_urbano_keys.pem** en descargas. 
2. Pega el siguiente comando (ajusta la ruta, recuerda cambiar `TU_USUARIO`) También puedes copiar la ruta del archivo desde tu Explorador de Archivos:

```bash
ssh -i "C:\Users\TU_USUARIO\Downloads\piensos_urbano_keys.pem" ubuntu@51.92.72.240
````

3. Pasa al punto 5 y 6

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
