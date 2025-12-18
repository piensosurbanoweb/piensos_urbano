cat << 'EOF' > README.md
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

## 🔹 Configuración SSH en VS Code

1. Abrir **VS Code**.
2. Pulsar \`F1\` o \`Ctrl+Shift+P\` → \`Remote-SSH: Open Configuration File...\`.
3. Seleccionar tu archivo de configuración de usuario (normalmente \`~/.ssh/config\`).
4. Añadir el siguiente bloque:

\`\`\`ssh
Host piensos-ec2
    HostName <IP_PÚBLICA_DE_EC2>
    User ubuntu
    IdentityFile ~/.ssh/piensosurbano-key.pem
\`\`\`

> **Nota:** Sustituir \`<IP_PÚBLICA_DE_EC2>\` por la IP real del servidor proporcionada por AWS.

---

## 🔹 Conexión al Servidor

1. Pulsar \`F1\` → **Remote-SSH: Connect to Host...**
2. Seleccionar \`piensos-ec2\`.
3. Se abrirá una nueva ventana de VS Code conectada remotamente al EC2.
4. **Abrir el proyecto:** \`File\` → \`Open Folder\` → \`/home/ubuntu/piensos_urbano\`
5. **Abrir terminal:** Usa el atajo \`Ctrl + @\` para ejecutar comandos directamente en el servidor.

---

## 🔹 Comandos útiles en el servidor

### 📂 Navegación y Archivos
\`\`\`bash
pwd                        # Mostrar ruta actual
ls -l                      # Listar archivos con detalles
cd /home/ubuntu/piensos_urbano  # Ir a la carpeta del proyecto
\`\`\`

### 🚀 Node.js y PM2
\`\`\`bash
npm install                # Instalar dependencias
node app.js                # Ejecutar Node directamente (pruebas)
pm2 start app.js --name tienda # Ejecutar con PM2 en segundo plano
pm2 list                   # Ver estado de los procesos
pm2 restart tienda         # Reiniciar la aplicación
pm2 logs tienda            # Ver logs en tiempo real
\`\`\`

### 🗄️ MySQL
\`\`\`bash
# Acceder a la base de datos
mysql -u piensos_user -p piensos_urbano

# Importar un script SQL (desde la terminal de Linux)
mysql -u piensos_user -p piensos_urbano < estructura.sql
\`\`\`

---

## 🔹 Acceso desde el Navegador
Dependiendo de la configuración de red:

* **Vía IP:** \`http://<IP_PUBLICA_EC2>\` (Si el puerto 80 está mapeado o usas Nginx).
* **Vía Puerto:** \`http://<IP_PUBLICA_EC2>:3000\` (Acceso directo a Node).
* **Vía Dominio:** \`https://<DOMINIO>\` (Si se configuró Certbot/SSL).

---

## ⚠️ Notas de Seguridad
* **No compartir** nunca la clave \`.pem\`.
* El puerto SSH (22) solo debe estar abierto para IPs autorizadas en el **Security Group** de AWS.
* Mantener el archivo \`.gitignore\` actualizado para no subir las credenciales de la DB al repositorio.

---

## 📍 Resumen de Rutas Importantes

| Elemento | Ruta |
| :--- | :--- |
| **Clave .pem** | \`~/.ssh/piensosurbano-key.pem\` |
| **Directorio Proyecto** | \`/home/ubuntu/piensos_urbano\` |
| **Config SSH Local** | \`~/.ssh/config\` |
| **Script SQL** | \`/home/ubuntu/piensos_urbano/estructura.sql\` |
EOF
