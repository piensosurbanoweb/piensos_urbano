# Cómo publicar la plantilla en Resend

Este archivo es solo para ti — no lo pegues en Resend, es únicamente la guía. El que sí va en Resend es `reset-password-resend-template.html`.

1. Ve a **resend.com/templates** → "Create template".
2. Pega el contenido de `reset-password-resend-template.html` en el editor de código HTML.
3. Rellena estos campos arriba del editor (los que salían en amarillo como "not set"):
   - **From**: `Piensos y Cereales Urbano <onboarding@resend.dev>`
   - **Subject**: `Recupera tu contraseña — Piensos y Cereales Urbano`
   - **Preview text** (opcional): `Restablece el acceso a tu cuenta en 1 clic`
4. Crea estas 3 variables (escribe `{{` en el editor para que te las sugiera, o desde el panel de variables) y ponles un valor de reserva ("fallback") a cada una:
   - `NOMBRE` → fallback: `cliente`
   - `ENLACE` → fallback: `#`
   - `LOGO_URL` → fallback: `https://piensosycerealesurbano.com/img/logo-empresa.jpg`
5. Pulsa **Publish**.
6. Copia el ID de la plantilla ya publicada (aparece en su URL o en el listado de plantillas) y pégalo como variable de entorno `RESEND_TEMPLATE_ID_RESET` en tu `.env` local y en Vercel (Project Settings → Environment Variables). Vuelve a desplegar para que Vercel la recoja.

Con eso, el correo de "olvidé mi contraseña" empezará a enviarse usando esta plantilla de Resend en vez del HTML que va dentro de `server.js`. Si algún día quieres cambiar el diseño del correo, ya no hace falta tocar código: se edita directamente en resend.com/templates y solo hay que publicar de nuevo (el ID no cambia).
