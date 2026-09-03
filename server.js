// Entrypoint único para Vercel (zero-config Express) y para desarrollo local
// (`npm start`). Vercel importa este archivo (module.exports = app) sin
// ejecutar app.listen; en local, node server.js sí lo ejecuta.

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const XLSX = require('xlsx');

const app = express();

// No se usa cors(): el frontend (HTML/CSS/JS) se sirve desde este mismo
// servidor Express, así que todas las peticiones de la propia app son del
// mismo origen y no necesitan CORS. Dejar cors() abierto solo serviría para
// permitir que OTRAS webs llamaran a esta API, así que se ha quitado.
app.use(express.json());
app.use(cookieParser());

// Conexión a Postgres (Supabase). La cadena de conexión se define en la
// variable de entorno DATABASE_URL (en Vercel: Project Settings -> Environment
// Variables; en local: archivo .env, ver .env.example).
if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL. Consulta .env.example / README.md.');
}

// Clave para firmar las sesiones (JWT guardado en una cookie httpOnly).
// Debe definirse en .env (local) y en Vercel (producción): ver .env.example.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET. Consulta .env.example / README.md.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requiere SSL
});

// --- AUTENTICACIÓN ---
// Middleware que exige una sesión válida (cookie "token" con un JWT firmado).
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No has iniciado sesión.' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' });
  }
}

// --- ROLES Y PERMISOS ---
// Jerarquía: desarrollador (superadmin) > propietario (admin) > gestor autorizado.
// El desarrollador puede gestionar a cualquiera (incluido el propietario).
// El propietario puede gestionar propietarios y gestores, pero NUNCA a un desarrollador.
// El gestor no gestiona usuarios en absoluto (tiene acceso al resto de la app igual que el propietario).
const ROLES_VALIDOS = ['desarrollador', 'propietario', 'gestor'];
function puedeGestionarRol(rolActor, rolObjetivo) {
  if (rolActor === 'desarrollador') return true;
  if (rolActor === 'propietario') return rolObjetivo !== 'desarrollador';
  return false;
}
// Middleware: solo desarrollador/propietario pueden entrar a gestión de usuarios.
function requireGestionUsuarios(req, res, next) {
  if (req.usuario?.rol !== 'desarrollador' && req.usuario?.rol !== 'propietario') {
    return res.status(403).json({ error: 'No tienes permiso para gestionar usuarios.' });
  }
  next();
}

// Rutas que no requieren sesión: login/logout, recuperación de contraseña, y
// los archivos estáticos conocidos (HTML/CSS/JS/imágenes/favicon) para que el
// login y sus recursos se puedan cargar sin estar ya autenticado.
//
// IMPORTANTE: antes esto se decidía con "la ruta pedida contiene un punto",
// pensado para dejar pasar archivos como "estilos.css". Pero varias rutas de
// datos reales aceptan un id en la URL (p.ej. "/pedidos_historial/:cliente_id",
// "/usuarios/:id/rol"), y por defecto ese id puede contener CUALQUIER carácter
// menos "/" — incluido un punto. Eso significaba que una petición manipulada
// como "/usuarios/5.a/rol" (con un punto metido en el id) "contenía un punto"
// y se colaba sin sesión hasta una ruta que cambia el rol de un usuario. Se
// sustituye por una lista concreta de lo que realmente es estático, para que
// ningún id de una ruta de datos pueda colarse por aquí.
const RUTAS_PUBLICAS = new Set(['/login', '/logout', '/forgot-password', '/reset-password', '/backup-cron']);
const PREFIJOS_ESTATICOS = ['/css/', '/js/', '/img/'];
// Fragmentos de pestañas (BaseDatos.html, Calendario.html...) y páginas raíz
// (login.html, index.html...): un único segmento de letras + ".html".
const ES_HTML_RAIZ = /^\/[A-Za-z][A-Za-z-]*\.html$/;

function esRecursoEstaticoConocido(ruta) {
  return ruta === '/favicon.ico'
    || PREFIJOS_ESTATICOS.some((prefijo) => ruta.startsWith(prefijo))
    || ES_HTML_RAIZ.test(ruta);
}

app.use((req, res, next) => {
  if (RUTAS_PUBLICAS.has(req.path) || req.path === '/' || req.path === '/inicio' || esRecursoEstaticoConocido(req.path)) {
    return next();
  }
  return requireAuth(req, res, next);
});

// --- ENVÍO DE EMAILS (Brevo) ---
// Se usa la API HTTP de Brevo directamente (fetch nativo de Node) para no
// añadir una dependencia nueva. Se eligió Brevo (en vez de Resend) porque
// permite enviar a CUALQUIER destinatario verificando solo una dirección de
// email remitente (sin necesitar un dominio propio ni configurar nada de
// DNS) — la web solo tiene el subdominio gratuito de Vercel, sin dominio
// propio. Hace falta la variable de entorno BREVO_API_KEY, y que
// BREVO_SENDER_EMAIL esté verificado como remitente en el panel de Brevo
// (ver .env.example).
// Plantilla del email de "recuperar contraseña", con el mismo diseño y
// colores de marca que el resto de la app (ver también emails/reset-password.html,
// que es una vista previa idéntica para abrir en el navegador).
function plantillaEmailReset(nombre, enlace, logoUrl) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu contraseña</title>
</head>
<body style="margin:0; padding:0; background-color:#f0fdf9; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf9; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background-color:#158765; padding:28px 24px;">
              <img src="${logoUrl}" width="64" height="64" alt="Piensos y Cereales Urbano, S.L."
                   style="display:block; width:64px; height:64px; border-radius:50%; object-fit:cover; border:3px solid #ffffff;">
              <p style="margin:12px 0 0; font-size:16px; font-weight:bold; color:#ffffff; font-family:Arial, Helvetica, sans-serif;">
                Piensos y Cereales Urbano, S.L.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px; font-family:Arial, Helvetica, sans-serif; color:#212529;">
              <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">Recupera tu contraseña</h1>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.5;">
                Hola <strong>${nombre}</strong>,
              </p>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.5;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en la aplicación de pedidos.
                Pulsa el siguiente botón para crear una contraseña nueva. Este enlace caduca en <strong>1 hora</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:8px; background-color:#158765;">
                    <a href="${enlace}"
                       style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px; font-family:Arial, Helvetica, sans-serif;">
                      Crear contraseña nueva
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:#6b7280;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 24px; font-size:13px; line-height:1.5; word-break:break-all;">
                <a href="${enlace}" style="color:#158765;">${enlace}</a>
              </p>
              <p style="margin:0; font-size:13px; line-height:1.5; color:#6b7280;">
                Si no has sido tú quien lo ha pedido, puedes ignorar este correo con tranquilidad: tu contraseña actual seguirá funcionando.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 24px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; font-family:Arial, Helvetica, sans-serif;">
                Piensos y Cereales Urbano, S.L. — Este es un correo automático, no respondas a esta dirección.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Remitente verificado en el panel de Brevo (Settings -> Senders). Tiene
// que ser un email real que se haya verificado ahí (no hace falta que sea
// de un dominio propio, puede ser un Gmail/Hotmail normal); si no se
// configura BREVO_SENDER_EMAIL, se usa este por defecto.
const BREVO_SENDER_EMAIL_POR_DEFECTO = 'piensosurbanoweb@gmail.com';

// Función interna compartida por las tres formas de enviar email de más
// abajo: hace la petición HTTP a la API de Brevo. `adjunto` es opcional:
// { filename, contentBase64 }.
async function enviarConBrevo(destinatario, asunto, html, adjunto) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    const msg = 'Falta la variable de entorno BREVO_API_KEY: no se puede enviar el email.';
    console.error(msg);
    return { ok: false, error: 'Falta configurar BREVO_API_KEY en Vercel.' };
  }
  try {
    const cuerpo = {
      sender: {
        name: 'Piensos y Cereales Urbano',
        email: process.env.BREVO_SENDER_EMAIL || BREVO_SENDER_EMAIL_POR_DEFECTO,
      },
      to: [{ email: destinatario }],
      subject: asunto,
      htmlContent: html,
    };
    if (adjunto) {
      cuerpo.attachment = [{ content: adjunto.contentBase64, name: adjunto.filename }];
    }
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });
    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Brevo devolvió un error:', resp.status, detalle);
      return { ok: false, error: `Brevo devolvió un error (${resp.status}): ${detalle}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('Error al enviar email con Brevo:', err.message);
    return { ok: false, error: err.message };
  }
}

async function enviarEmail(destinatario, asunto, html) {
  const resultado = await enviarConBrevo(destinatario, asunto, html);
  return resultado.ok;
}

// Envía un email con un archivo adjunto (usado para la copia de seguridad
// automática). `adjunto` = { filename, contentBase64 }.
async function enviarEmailConAdjunto(destinatario, asunto, html, adjunto) {
  return enviarConBrevo(destinatario, asunto, html, adjunto);
}

// Genera un Excel (un libro con una hoja por tabla) con todos los datos
// actuales de la base de datos, para la copia de seguridad automática.
// Las tablas a incluir se leen dinámicamente de information_schema para no
// tener que mantener una lista a mano si en el futuro se añaden tablas
// nuevas. La tabla "usuarios" se trata aparte para no incluir nunca el hash
// de las contraseñas en la copia.
async function generarBackupExcel() {
  const { rows: tablas } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const libro = XLSX.utils.book_new();

  const aFilasPlanas = (rows) => rows.map((fila) => {
    const plano = {};
    for (const [clave, valor] of Object.entries(fila)) {
      plano[clave] = valor instanceof Date ? valor.toISOString() : valor;
    }
    return plano;
  });

  for (const { table_name: tabla } of tablas) {
    if (tabla === 'usuarios') continue; // se añade aparte, sin password_hash
    const { rows } = await pool.query(`SELECT * FROM "${tabla}"`);
    const hoja = XLSX.utils.json_to_sheet(aFilasPlanas(rows.length ? rows : [{}]));
    XLSX.utils.book_append_sheet(libro, hoja, tabla.substring(0, 31));
  }

  const { rows: usuarios } = await pool.query(
    'SELECT id, nombre, nombre_usuario, email, rol, activo FROM usuarios ORDER BY id'
  );
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(aFilasPlanas(usuarios)), 'usuarios');

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

// Ruta que dispara la copia de seguridad automática por email. La llama
// Vercel Cron según la programación de vercel.json (ver ese archivo). Está
// protegida con CRON_SECRET: sin esa variable de entorno definida en Vercel,
// esta ruta rechaza cualquier petición, para que nadie pueda hacer que la
// app envíe copias de los datos con solo visitar la URL.
// Genera y envía la copia de seguridad; la usan tanto la ruta del cron
// (backup-cron) como el botón manual de "Enviar copia de seguridad ahora"
// (backup-manual), para no repetir la lógica dos veces.
async function generarYEnviarBackup() {
  const buffer = await generarBackupExcel();
  // Se envía a varios destinatarios a la vez: el de siempre (BACKUP_EMAIL,
  // o el correo por defecto si no está configurado) y el del cliente. Se
  // manda un email por destinatario (en vez de uno solo con varios "to")
  // para que, si uno falla, el resto no se vea afectado.
  const destinatarios = [...new Set([
    process.env.BACKUP_EMAIL || 'piensosurbanoweb@gmail.com',
    'piensosurbano@hotmail.com',
  ])];
  const fecha = new Date().toLocaleDateString('es-ES');
  const fechaArchivo = fecha.replace(/\//g, '-');
  const html = `
    <p>Copia de seguridad de <strong>Piensos y Cereales Urbano</strong> generada el ${fecha}.</p>
    <p>Va adjunta en un Excel con todos los clientes, pedidos, conductores, camiones, zonas y usuarios tal cual están ahora mismo.</p>
    <p><strong>Importante:</strong> los datos están repartidos en varias pestañas dentro del propio Excel (una por cada tipo de dato).
    Muchos correos solo muestran la primera pestaña en la vista previa, así que descarga el archivo y ábrelo con Excel (o similar) para ver todas.</p>
  `;
  const adjunto = { filename: `copia_de_seguridad_piensos_urbano_${fechaArchivo}.xlsx`, contentBase64: buffer.toString('base64') };
  const asunto = `Copia de seguridad - Piensos y Cereales Urbano (${fecha})`;

  const resultados = await Promise.all(
    destinatarios.map(async (destinatario) => ({
      destinatario,
      resultado: await enviarEmailConAdjunto(destinatario, asunto, html, adjunto),
    }))
  );

  const fallos = resultados.filter(r => !r.resultado.ok);
  const exitos = resultados.filter(r => r.resultado.ok);

  if (exitos.length === 0) {
    // No ha llegado a nadie: es un fallo real.
    return { ok: false, error: fallos.map(f => `${f.destinatario}: ${f.resultado.error}`).join(' | ') };
  }
  if (fallos.length > 0) {
    // Ha llegado al menos a uno, pero no a todos: se avisa sin marcarlo como fallo total
    // (por ejemplo, Resend sin dominio verificado solo deja enviar a la cuenta registrada).
    return { ok: true, avisos: fallos.map(f => `No llegó a ${f.destinatario}: ${f.resultado.error}`) };
  }
  return { ok: true };
}

app.get('/backup-cron', async (req, res) => {
  try {
    const secreto = process.env.CRON_SECRET;
    if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const resultado = await generarYEnviarBackup();
    if (!resultado.ok) return res.status(500).json({ error: resultado.error });
    if (resultado.avisos) console.warn('Copia de seguridad (cron) con avisos:', resultado.avisos.join(' | '));
    res.json({ ok: true, avisos: resultado.avisos });
  } catch (err) {
    console.error('Error generando la copia de seguridad programada:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Botón "Enviar copia de seguridad ahora" en Gestión BD: hace exactamente lo
// mismo que el cron, pero al momento y para cualquier usuario con sesión
// iniciada, para poder comprobar que el envío de emails está bien
// configurado sin tener que esperar a la fecha programada. Devuelve el
// motivo exacto del fallo (por ejemplo, si falta configurar Resend) para
// poder solucionarlo.
app.post('/backup-manual', async (req, res) => {
  try {
    const resultado = await generarYEnviarBackup();
    if (!resultado.ok) return res.status(500).json({ error: resultado.error });
    res.json({ ok: true, avisos: resultado.avisos });
  } catch (err) {
    console.error('Error generando la copia de seguridad manual:', err.message);
    res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { nombre_usuario, contrasena } = req.body;
    if (!nombre_usuario || !contrasena) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE nombre_usuario = $1 AND activo = true',
      [nombre_usuario]
    );
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const contrasenaOk = await bcrypt.compare(contrasena, usuario.password_hash);
    if (!contrasenaOk) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const token = jwt.sign(
      { id: usuario.id, nombre_usuario: usuario.nombre_usuario, nombre: usuario.nombre, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ success: true, nombre: usuario.nombre });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/me', async (req, res) => {
  try {
    // Se consulta la base de datos (en vez de fiarse solo del JWT) para que
    // el email y el nombre mostrados estén siempre al día, aunque el usuario
    // los haya cambiado desde otra pestaña/dispositivo con la misma sesión.
    const { rows } = await pool.query(
      'SELECT id, nombre, nombre_usuario, email, rol FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    const usuario = rows[0];
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(usuario);
  } catch (err) {
    console.error('Error al obtener /me:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- EDITAR MI PROPIO PERFIL (nombre y email; la contraseña va por /change-password) ---
app.patch('/me', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }
    const emailLimpio = email && email.trim() ? email.trim() : null;

    const { rows } = await pool.query(
      `UPDATE usuarios SET nombre = $1, email = $2 WHERE id = $3
       RETURNING id, nombre, nombre_usuario, email, rol`,
      [nombre.trim(), emailLimpio, req.usuario.id]
    );
    const actualizado = rows[0];

    // Se reemite la cookie de sesión con el nombre actualizado para que el
    // resto de la app (avatar, menú, etc., que leen el nombre del JWT) lo
    // reflejen sin tener que volver a iniciar sesión.
    const token = jwt.sign(
      { id: actualizado.id, nombre_usuario: actualizado.nombre_usuario, nombre: actualizado.nombre, rol: actualizado.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.json(actualizado);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese email ya está en uso por otro usuario.' });
    }
    console.error('Error al actualizar el perfil:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- CAMBIO DE CONTRASEÑA (usuario ya logueado, cambia la suya propia) ---
app.post('/change-password', async (req, res) => {
  try {
    const { contrasena_actual, contrasena_nueva } = req.body;
    if (!contrasena_actual || !contrasena_nueva) {
      return res.status(400).json({ error: 'Escribe tu contraseña actual y la nueva.' });
    }
    if (contrasena_nueva.length < 8) {
      return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres.' });
    }
    const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuario = rows[0];
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const ok = await bcrypt.compare(contrasena_actual, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta.' });

    const hash = await bcrypt.hash(contrasena_nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.usuario.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al cambiar la contraseña:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- RECUPERACIÓN DE CONTRASEÑA (sin sesión iniciada) ---
app.post('/forgot-password', async (req, res) => {
  // Siempre se responde igual, exista o no ese usuario/email, para no revelar
  // qué cuentas existen (evita que alguien use esto para adivinar usuarios).
  const RESPUESTA_GENERICA = { success: true, message: 'Si ese usuario o email existe y tiene un correo asociado, recibirás un enlace para recuperar la contraseña.' };
  try {
    const { usuario_o_email } = req.body;
    if (!usuario_o_email) return res.json(RESPUESTA_GENERICA);

    const { rows } = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE (nombre_usuario = $1 OR email = $1) AND activo = true',
      [usuario_o_email]
    );
    const usuario = rows[0];
    if (usuario && usuario.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await pool.query(
        'UPDATE usuarios SET reset_token_hash = $1, reset_token_expira = $2 WHERE id = $3',
        [tokenHash, expira, usuario.id]
      );
      const enlace = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      const logoUrl = `${req.protocol}://${req.get('host')}/img/logo-empresa.jpg`;

      await enviarEmail(
        usuario.email,
        'Recupera tu contraseña — Piensos y Cereales Urbano',
        plantillaEmailReset(usuario.nombre, enlace, logoUrl)
      );
    }
    res.json(RESPUESTA_GENERICA);
  } catch (err) {
    console.error('Error en recuperación de contraseña:', err.message);
    res.json(RESPUESTA_GENERICA);
  }
});

app.post('/reset-password', async (req, res) => {
  try {
    const { token, contrasena } = req.body;
    if (!token || !contrasena) {
      return res.status(400).json({ error: 'Faltan datos.' });
    }
    if (contrasena.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      'SELECT id FROM usuarios WHERE reset_token_hash = $1 AND reset_token_expira > now() AND activo = true',
      [tokenHash]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, reset_token_hash = NULL, reset_token_expira = NULL WHERE id = $2',
      [hash, usuario.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al restablecer la contraseña:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- GESTIÓN DE USUARIOS Y ROLES ---
// Solo desarrollador/propietario pueden entrar aquí (requireGestionUsuarios).
// Dentro, además, se respeta la jerarquía: el propietario nunca puede crear,
// editar ni desactivar a un desarrollador (superadmin).
app.get('/usuarios', requireGestionUsuarios, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre_usuario, nombre, email, rol, activo, creado_en FROM usuarios WHERE activo = true ORDER BY rol, nombre_usuario'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

app.post('/usuarios', requireGestionUsuarios, async (req, res) => {
  try {
    const { nombre_usuario, nombre, email, contrasena, rol } = req.body;
    if (!nombre_usuario || !nombre || !contrasena) {
      return res.status(400).json({ error: 'Nombre de usuario, nombre y contraseña son obligatorios.' });
    }
    if (contrasena.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    const rolFinal = rol || 'gestor';
    if (!ROLES_VALIDOS.includes(rolFinal)) {
      return res.status(400).json({ error: 'Rol no válido.' });
    }
    if (!puedeGestionarRol(req.usuario.rol, rolFinal)) {
      return res.status(403).json({ error: 'No tienes permiso para crear un usuario con ese rol.' });
    }
    const hash = await bcrypt.hash(contrasena, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre_usuario, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre_usuario, nombre, email, rol, activo`,
      [nombre_usuario, nombre, email || null, hash, rolFinal]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario o email ya existe.' });
    }
    console.error('Error al crear usuario:', err.message);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
});

// Cambia el rol de un usuario (solo desarrollador/propietario, respetando la jerarquía).
app.patch('/usuarios/:id/rol', requireGestionUsuarios, async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido.' });
    }
    const { rows } = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [id]);
    const objetivo = rows[0];
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Hace falta poder gestionar tanto el rol actual del usuario como el rol nuevo que se le quiere dar.
    if (!puedeGestionarRol(req.usuario.rol, objetivo.rol) || !puedeGestionarRol(req.usuario.rol, rol)) {
      return res.status(403).json({ error: 'No tienes permiso para asignar ese rol.' });
    }
    await pool.query('UPDATE usuarios SET rol = $1 WHERE id = $2', [rol, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al cambiar el rol:', err.message);
    res.status(500).json({ error: 'Error al cambiar el rol.' });
  }
});

app.delete('/usuarios/:id', requireGestionUsuarios, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.usuario.id) === String(id)) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario mientras tienes la sesión abierta.' });
    }
    const { rows } = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [id]);
    const objetivo = rows[0];
    if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (!puedeGestionarRol(req.usuario.rol, objetivo.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para desactivar a este usuario.' });
    }
    await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al desactivar usuario:', err.message);
    res.status(500).json({ error: 'Error al desactivar el usuario.' });
  }
});

// Helper para obtener día de la semana (UTC)
function getDiaRepartoUTC(fechaISO) {
  const d = new Date(fechaISO);
  const nombres = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const n = d.getUTCDay();
  return nombres[n];
}

// Equivalente en JS a lo que antes hacía MySQL con SUBSTRING_INDEX sobre
// descripcion = "${cantidad} de ${producto} - ${apodo_cliente}". Se mantiene
// solo como respaldo para registros muy antiguos que no tengan filas en
// pedido_items; el camino normal ahora es la columna "items" (ver
// SUBQUERY_ITEMS más abajo).
function parseDescripcion(descripcion) {
  const antesGuion = (descripcion || '').split(' - ')[0];
  const partes = antesGuion.split(' de ');
  const cantidad = partes[0] || '';
  const producto = partes.length > 1 ? partes[partes.length - 1] : '';
  return { cantidad, producto };
}

// Construye el texto resumen de un pedido a partir de sus líneas
// (items), p.ej. "2 de Pienso Gato, 1 de Pienso Perro". Se usa para poder
// seguir mostrando un pedido como una sola línea de texto en sitios que no
// se han cambiado a leer el array "items" directamente (pedidos_pendientes,
// impresiones, etc.), sin perder la información de que tiene varios
// productos.
function resumenItems(items) {
  return items.map((it) => `${it.cantidad} de ${it.producto}`).join(', ');
}

// Fragmento SQL reutilizable: trae, para un pedido de pedidos_historial
// (alias "h" obligatorio en la consulta que lo use), todas sus líneas de
// pedido_items como un array JSON [{cantidad, producto}, ...]. Así una
// única fila de pedidos_calendario/pedidos_pendientes puede representar un
// pedido con varios productos sin duplicar filas.
const SUBQUERY_ITEMS = `(
  SELECT COALESCE(json_agg(json_build_object('cantidad', pi.cantidad, 'producto', pi.producto) ORDER BY pi.orden, pi.id), '[]'::json)
  FROM pedido_items pi WHERE pi.historial_id = h.id
) AS items`;

// || RUTAS DE API ||

// --- CLIENTES ---
app.get('/clientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO clientes (apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al insertar cliente' });
  }
});

app.put('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    const { rows } = await pool.query(
      `UPDATE clientes SET apodo=$1, nombre_completo=$2, telefono=$3, localidad=$4, zona_reparto=$5, observaciones=$6
       WHERE id=$7 RETURNING *`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clientes WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

// --- PEDIDOS ---
// Un pedido puede incluir varios productos (items) en un mismo proceso de
// compra: el cliente recibe UNA sola parada de reparto con todo lo que ha
// pedido, en vez de tener que crear un pedido por producto. `items` debe ser
// un array [{ cantidad, producto }, ...] con al menos un elemento; por
// compatibilidad, si llega el formato antiguo (cantidad/producto sueltos en
// vez de items), se trata como un pedido de un solo producto.
// --- IMPORTACIÓN MASIVA DESDE EXCEL ---
// El Excel se lee y se traduce a este formato en el propio navegador (ver
// functions_copy_claude.js), porque cada Excel real usa sus propios nombres
// de columna; aquí solo llegan los datos ya mapeados. Se procesa fila a
// fila, sin abortar todo si una fila falla, porque es normal que un Excel
// real traiga alguna fila incompleta o rara: mejor importar 98 de 100 filas
// e informar de las 2 que han fallado, que no importar nada.
app.post('/clientes/importar', async (req, res) => {
  const filas = Array.isArray(req.body.clientes) ? req.body.clientes : [];
  let creados = 0;
  let actualizados = 0;
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i] || {};
    const numeroFila = i + 2; // +2: la fila 1 del Excel es la cabecera
    try {
      const apodo = String(fila.apodo || '').trim();
      const nombre_completo = String(fila.nombre_completo || '').trim();
      const zona_reparto = String(fila.zona_reparto || '').trim();
      if (!apodo || !nombre_completo || !zona_reparto) {
        errores.push({ fila: numeroFila, motivo: 'Faltan el apodo, el nombre o la zona de reparto.' });
        continue;
      }
      const telefono = String(fila.telefono || '').trim() || null;
      const localidad = String(fila.localidad || '').trim() || null;
      const observaciones = String(fila.observaciones || '').trim() || null;

      const existente = await pool.query('SELECT id FROM clientes WHERE LOWER(apodo) = LOWER($1)', [apodo]);

      if (existente.rows.length > 0) {
        await pool.query(
          `UPDATE clientes SET nombre_completo=$1, telefono=$2, localidad=$3, zona_reparto=$4, observaciones=$5
           WHERE id=$6`,
          [nombre_completo, telefono, localidad, zona_reparto, observaciones, existente.rows[0].id]
        );
        actualizados++;
      } else {
        await pool.query(
          `INSERT INTO clientes (apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones]
        );
        creados++;
      }
    } catch (err) {
      console.error(`Error importando cliente (fila ${numeroFila}):`, err.message);
      errores.push({ fila: numeroFila, motivo: 'Error al guardar en la base de datos.' });
    }
  }

  res.json({ creados, actualizados, errores });
});

// Igual que POST /pedidos (crea el pedido en pedidos, pedidos_historial y
// pedido_items), pero fila a fila desde un Excel, buscando el cliente por
// su apodo en vez de recibir el cliente_id directamente, y con la opción de
// no meter el pedido en "pedidos_pendientes" (por defecto no, para no
// llenar la pestaña de Pendientes con pedidos que en realidad son
// históricos y ya se repartieron).
app.post('/pedidos/importar', async (req, res) => {
  const filas = Array.isArray(req.body.pedidos) ? req.body.pedidos : [];
  const marcarPendientes = !!req.body.marcarPendientes;
  let creados = 0;
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i] || {};
    const numeroFila = i + 2;
    const apodo = String(fila.apodo_cliente || '').trim();
    const producto = String(fila.producto || '').trim();
    const cantidad = String(fila.cantidad || '').trim();

    if (!apodo || !producto || !cantidad) {
      errores.push({ fila: numeroFila, motivo: 'Faltan el apodo del cliente, el producto o la cantidad.' });
      continue;
    }

    const client = await pool.connect();
    try {
      const clienteRes = await client.query(
        'SELECT id, apodo, nombre_completo, telefono, localidad, zona_reparto FROM clientes WHERE LOWER(apodo) = LOWER($1)',
        [apodo]
      );
      if (clienteRes.rows.length === 0) {
        errores.push({ fila: numeroFila, motivo: `No existe ningún cliente con el apodo "${apodo}" (impórtalo primero).` });
        continue;
      }
      const cliente = clienteRes.rows[0];
      const tipo = String(fila.tipo || '').trim() || null;
      const dia_semana = String(fila.dia_semana || '').trim() || null;
      const fecha_entrega = String(fila.fecha_entrega || '').trim() || null;
      const observaciones = String(fila.observaciones || '').trim() || null;

      await client.query('BEGIN');

      const pedidoResult = await client.query(
        `INSERT INTO pedidos (cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, fecha_creacion`,
        [cliente.id, cliente.apodo, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones]
      );
      const fechaPedido = pedidoResult.rows[0].fecha_creacion;

      const descripcion = `${cantidad} de ${producto} - ${cliente.apodo}`;
      const historialResult = await client.query(
        `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [cliente.id, descripcion, fechaPedido, fecha_entrega, observaciones]
      );
      const historialId = historialResult.rows[0].id;

      await client.query(
        `INSERT INTO pedido_items (historial_id, producto, cantidad, orden) VALUES ($1, $2, $3, 0)`,
        [historialId, producto, cantidad]
      );

      if (marcarPendientes) {
        await client.query(
          `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [historialId, cliente.id, cliente.apodo, cliente.nombre_completo, cliente.telefono, cliente.localidad, cliente.zona_reparto, `${cantidad} de ${producto}`, fecha_entrega, observaciones, dia_semana]
        );
      }

      await client.query('COMMIT');
      creados++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error importando pedido (fila ${numeroFila}):`, err.message);
      errores.push({ fila: numeroFila, motivo: 'Error al guardar en la base de datos.' });
    } finally {
      client.release();
    }
  }

  res.json({ creados, errores });
});

app.post('/pedidos', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { cliente_id, apodo_cliente, tipo, dia_semana, fecha_entrega, observaciones } = req.body;
    let items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items && req.body.cantidad && req.body.producto) {
      items = [{ cantidad: req.body.cantidad, producto: req.body.producto }];
    }
    items = (items || [])
      .map((it) => ({ cantidad: String(it.cantidad || '').trim(), producto: String(it.producto || '').trim() }))
      .filter((it) => it.cantidad && it.producto);

    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El pedido necesita al menos un producto con cantidad.' });
    }

    // Se guarda también un resumen de un solo producto (el primero) en la
    // tabla "pedidos" por compatibilidad con datos/consultas antiguas; el
    // detalle real de todos los productos vive en pedido_items.
    const pedidoResult = await client.query(
      `INSERT INTO pedidos (cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, fecha_creacion`,
      [cliente_id, apodo_cliente, tipo, dia_semana, items[0].cantidad, items[0].producto, fecha_entrega, observaciones]
    );
    const newPedidoId = pedidoResult.rows[0].id;
    const fechaPedido = pedidoResult.rows[0].fecha_creacion;

    const resumen = resumenItems(items);
    const descripcion = `${resumen} - ${apodo_cliente}`;
    const historialResult = await client.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [cliente_id, descripcion, fechaPedido, fecha_entrega, observaciones]
    );
    const historialId = historialResult.rows[0].id;

    for (let i = 0; i < items.length; i++) {
      await client.query(
        `INSERT INTO pedido_items (historial_id, producto, cantidad, orden) VALUES ($1, $2, $3, $4)`,
        [historialId, items[i].producto, items[i].cantidad, i]
      );
    }

    const clienteResult = await client.query(
      'SELECT apodo, nombre_completo, telefono, localidad, zona_reparto FROM clientes WHERE id = $1',
      [cliente_id]
    );
    const clienteData = clienteResult.rows[0];

    let diaRepartoCorregido = dia_semana;
    if (!diaRepartoCorregido || diaRepartoCorregido.trim() === '') {
      const pedidoOriginalResult = await client.query('SELECT dia_semana FROM pedidos WHERE id = $1', [newPedidoId]);
      diaRepartoCorregido = pedidoOriginalResult.rows[0]?.dia_semana || null;
    }

    await client.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [historialId, cliente_id, clienteData.apodo, clienteData.nombre_completo, clienteData.telefono, clienteData.localidad, clienteData.zona_reparto, resumen, fecha_entrega, observaciones, diaRepartoCorregido]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Pedido registrado en todas las tablas.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de pedidos:', err.message);
    res.status(500).json({ error: 'Error al registrar el pedido', details: err.message });
  } finally {
    client.release();
  }
});

// --- HISTORIAL DE PEDIDOS ---
// Se limita a los 3 pedidos más recientes del cliente (antes no había
// límite / se usaba 5), ordenados por fecha de creación descendente.
app.get('/pedidos_historial/:cliente_id', async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const { rows } = await pool.query(
      `SELECT h.*, ${SUBQUERY_ITEMS}
       FROM pedidos_historial h
       WHERE h.cliente_id = $1
       ORDER BY h.fecha_pedido DESC
       LIMIT 3`,
      [cliente_id]
    );
    // Si un registro muy antiguo no tiene filas en pedido_items (de antes de
    // este cambio), se reconstruye un único item a partir de "descripcion"
    // para no dejar el historial vacío.
    const resultado = rows.map((r) => ({
      ...r,
      items: r.items && r.items.length > 0 ? r.items : [parseDescripcion(r.descripcion)],
    }));
    res.json(resultado);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Historial completo (sin límite), usado por la exportación a PDF del historial de un cliente.
app.get('/pedidos_historial/:cliente_id/completo', async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const { rows } = await pool.query(
      `SELECT h.*, ${SUBQUERY_ITEMS}
       FROM pedidos_historial h
       WHERE h.cliente_id = $1
       ORDER BY h.fecha_pedido DESC`,
      [cliente_id]
    );
    const resultado = rows.map((r) => ({
      ...r,
      items: r.items && r.items.length > 0 ? r.items : [parseDescripcion(r.descripcion)],
    }));
    res.json(resultado);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener historial completo' });
  }
});

app.post('/pedidos_historial', async (req, res) => {
  try {
    const { cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al insertar pedido historial' });
  }
});

// --- PEDIDOS PENDIENTES ---
app.get('/pedidos_pendientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pedidos_pendientes ORDER BY fecha_programacion DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos pendientes:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos pendientes' });
  }
});

app.get('/pedidos/pendientes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id, historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona,
        pedido, fecha_programacion, observaciones, dia_reparto
      FROM pedidos_pendientes
      ORDER BY dia_reparto, apodo
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos pendientes:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos pendientes.' });
  }
});

app.post('/pedidos_pendientes', async (req, res) => {
  try {
    const { historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al insertar pedido pendiente:', err.message);
    res.status(500).json({ error: 'Error al insertar pedido pendiente' });
  }
});


// Detalle completo de un pedido pendiente (para el modal de "Editar"): sus
// productos/cantidades (pedido_items) y sus observaciones.
app.get('/pedidos_pendientes/:id/detalle', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT p.id, p.historial_id, p.observaciones, p.fecha_programacion, ${SUBQUERY_ITEMS}
       FROM pedidos_pendientes p
       JOIN pedidos_historial h ON h.id = p.historial_id
       WHERE p.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener el detalle del pedido pendiente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Edita un pedido pendiente: productos/cantidades, observaciones y fecha
// programada. Actualiza a la vez pedidos_pendientes, pedidos_historial (que
// es el registro permanente) y pedido_items (se borran y se vuelven a
// crear con la lista nueva, más simple que calcular altas/bajas/cambios).
app.put('/pedidos_pendientes/:id/editar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { fecha_programacion, observaciones } = req.body;
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .map((it) => ({ cantidad: String(it.cantidad || '').trim(), producto: String(it.producto || '').trim() }))
      .filter((it) => it.cantidad && it.producto);

    if (items.length === 0) {
      return res.status(400).json({ error: 'El pedido necesita al menos un producto con cantidad.' });
    }

    await client.query('BEGIN');
    const actual = await client.query('SELECT historial_id FROM pedidos_pendientes WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const historialId = actual.rows[0].historial_id;
    const resumen = resumenItems(items);
    const diaReparto = fecha_programacion ? getDiaRepartoUTC(fecha_programacion) : null;

    await client.query(
      `UPDATE pedidos_pendientes SET fecha_programacion=$1, dia_reparto=$2, observaciones=$3, pedido=$4 WHERE id=$5`,
      [fecha_programacion || null, diaReparto, observaciones || null, resumen, id]
    );
    await client.query(
      `UPDATE pedidos_historial SET observaciones=$1, fecha_entrega=$2 WHERE id=$3`,
      [observaciones || null, fecha_programacion || null, historialId]
    );
    await client.query('DELETE FROM pedido_items WHERE historial_id = $1', [historialId]);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        `INSERT INTO pedido_items (historial_id, producto, cantidad, orden) VALUES ($1, $2, $3, $4)`,
        [historialId, items[i].producto, items[i].cantidad, i]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al editar el pedido pendiente:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

app.delete('/pedidos_pendientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM pedidos_pendientes WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar pedido pendiente:', err.message);
    res.status(500).json({ error: 'Error al eliminar pedido pendiente' });
  }
});

// --- MARCAR PEDIDO COMO PROGRAMADO ---
app.put('/pedidos/programar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE pedidos SET estado = 'programado' WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al marcar pedido como programado:', err.message);
    res.status(500).json({ error: 'Error al actualizar el estado del pedido' });
  }
});

// OBTENER DETALLES DE UN PEDIDO ESPECÍFICO
app.get('/pedidos/detalles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.fecha_entrega AS fecha_entrega,
         p.dia_reparto,
         p.observaciones,
         c.apodo AS apodo_cliente, c.telefono, c.localidad,
         ${SUBQUERY_ITEMS}
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener detalles del pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- PEDIDOS CALENDARIO ---
app.get('/pedidos_calendario', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const vista = req.query.vista === 'mensual' ? 'mensual' : 'semanal';
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    let desde, hasta;

    if (vista === 'mensual') {
      // Rango de un mes completo, desplazado 'offset' meses respecto al mes actual.
      desde = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      hasta = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
    } else {
      // Rango de la semana (lunes a domingo) desplazada 'offset' semanas.
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() + offset * 7 - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      desde = firstDayOfWeek;
      hasta = lastDayOfWeek;
    }

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.dia_reparto,
         p.fecha_entrega AS fecha_reparto,
         c.apodo AS apodo_cliente,
         ${SUBQUERY_ITEMS}
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       JOIN clientes c ON p.cliente_id = c.id
       WHERE p.fecha_entrega BETWEEN $1 AND $2
       ORDER BY p.fecha_entrega`,
      [desde.toISOString().split('T')[0], hasta.toISOString().split('T')[0]]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos del calendario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Pedidos diarios por dia_reparto
app.get('/pedidos/diarios/:dia', async (req, res) => {
  try {
    const { dia } = req.params;
    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.dia_reparto,
         p.fecha_entrega AS fecha_reparto,
         c.apodo AS apodo_cliente,
         p.observaciones,
         ${SUBQUERY_ITEMS}
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.dia_reparto = $1
       ORDER BY p.fecha_entrega, c.apodo`,
      [dia]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos diarios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post('/pedidos_calendario', async (req, res) => {
  try {
    const { historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO pedidos_calendario (historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al insertar pedido calendario' });
  }
});

app.put('/pedidos_calendario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const { rows } = await pool.query(
      `UPDATE pedidos_calendario SET orden_reparto=$1, conductor=$2, camion=$3, observaciones=$4, enviado_reparto=$5, fecha_envio_reparto=$6
       WHERE id=$7 RETURNING *`,
      [orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al actualizar pedido calendario' });
  }
});


// Edita el contenido de un pedido ya programado en el calendario:
// productos/cantidades, observaciones y fecha de entrega (el día de la
// semana se recalcula solo a partir de la fecha, igual que en
// /pedidos/editar-fecha). Distinta de PUT /pedidos_calendario/:id de
// arriba, que es la que usa la Hoja de Reparto para orden/conductor/camión.
app.put('/pedidos_calendario/:id/editar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { fecha_entrega, observaciones } = req.body;
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .map((it) => ({ cantidad: String(it.cantidad || '').trim(), producto: String(it.producto || '').trim() }))
      .filter((it) => it.cantidad && it.producto);

    if (items.length === 0) {
      return res.status(400).json({ error: 'El pedido necesita al menos un producto con cantidad.' });
    }

    await client.query('BEGIN');
    const actual = await client.query('SELECT historial_id FROM pedidos_calendario WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const historialId = actual.rows[0].historial_id;
    const diaReparto = fecha_entrega ? getDiaRepartoUTC(fecha_entrega) : null;

    await client.query(
      `UPDATE pedidos_calendario SET fecha_entrega=$1, dia_reparto=$2, observaciones=$3 WHERE id=$4`,
      [fecha_entrega || null, diaReparto, observaciones || null, id]
    );
    await client.query(
      `UPDATE pedidos_historial SET observaciones=$1, fecha_entrega=$2 WHERE id=$3`,
      [observaciones || null, fecha_entrega || null, historialId]
    );
    await client.query('DELETE FROM pedido_items WHERE historial_id = $1', [historialId]);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        `INSERT INTO pedido_items (historial_id, producto, cantidad, orden) VALUES ($1, $2, $3, $4)`,
        [historialId, items[i].producto, items[i].cantidad, i]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al editar el pedido del calendario:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

app.delete('/pedidos_calendario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM pedidos_calendario WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar pedido calendario' });
  }
});

// Ruta para mover un pedido de pendientes a calendario
async function programarConFecha(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { fecha } = req.body;

    const result = await client.query(
      'SELECT historial_id, cliente_id, observaciones, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = $1',
      [id]
    );
    const pedido = result.rows[0];

    if (!pedido) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const diaDeLaSemana = getDiaRepartoUTC(fecha);

    await client.query(
      `INSERT INTO pedidos_calendario (historial_id, cliente_id, dia_reparto, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5)`,
      [pedido.historial_id, pedido.cliente_id, diaDeLaSemana, fecha, pedido.observaciones]
    );

    await client.query('DELETE FROM pedidos_pendientes WHERE historial_id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Pedido programado con éxito.',
      dia_reparto: diaDeLaSemana,
      fecha_entrega: fecha,
      fecha_reparto: fecha,
      apodo: pedido.apodo,
      pedido: pedido.pedido,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de programación:', err.message);
    res.status(500).json({ error: 'Error al programar el pedido' });
  } finally {
    client.release();
  }
}

app.post('/pedidos/programar-con-fecha/:id', programarConFecha);
// Alias para compatibilidad con el frontend actual
app.post('/pedidos/mover-a-calendario/:id', programarConFecha);

// --- CONDUCTORES ---
app.get('/conductores', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM conductores WHERE activo=true ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener conductores' });
  }
});

app.post('/conductores', async (req, res) => {
  try {
    const { nombre } = req.body;
    const { rows } = await pool.query('INSERT INTO conductores (nombre) VALUES ($1) RETURNING *', [nombre]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al insertar conductor' });
  }
});

app.delete('/conductores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE conductores SET activo=false WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar conductor' });
  }
});

// --- CAMIONES ---
app.get('/camiones', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM camiones WHERE activo=true ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener camiones' });
  }
});

app.post('/camiones', async (req, res) => {
  try {
    const { matricula } = req.body;
    if (!matricula) {
      return res.status(400).json({ error: 'La matrícula es requerida.' });
    }
    const { rows } = await pool.query('INSERT INTO camiones (nombre) VALUES ($1) RETURNING *', [matricula]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al insertar camión:', err.message);
    res.status(500).json({ error: 'Error al insertar camión.' });
  }
});

app.delete('/camiones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE camiones SET activo=false WHERE id=$1', [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al eliminar camión:', err.message);
    res.status(500).json({ error: 'Error al eliminar camión' });
  }
});

// --- ZONAS ---
app.get('/zonas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM zonas WHERE activa=true ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
});

app.post('/zonas', async (req, res) => {
  try {
    const { nombre } = req.body;
    const { rows } = await pool.query('INSERT INTO zonas (nombre) VALUES ($1) RETURNING *', [nombre]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al insertar zona' });
  }
});

app.delete('/zonas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE zonas SET activa=false WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
});

// EDITAR FECHA DE LOS PEDIDOS DE CALENDARIO
app.patch('/pedidos/editar-fecha/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha } = req.body;
    const nuevoDia = getDiaRepartoUTC(fecha);

    const { rows, rowCount } = await pool.query(
      `UPDATE pedidos_calendario SET fecha_entrega = $1, dia_reparto = $2 WHERE id = $3 RETURNING *`,
      [fecha, nuevoDia, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar la fecha del pedido:', err.message);
    res.status(500).json({ error: 'Error al actualizar la fecha del pedido' });
  }
});

// --- FUNCIONES DE HOJA DE REPARTO ---
// La "hoja de reparto" no es una tabla aparte: son los pedidos de
// pedidos_calendario marcados con enviado_reparto = true. Así los datos del
// pedido (cliente, teléfono, zona, día, producto...) siempre están
// sincronizados con el calendario y no hay que duplicarlos. Los pedidos
// entran a la hoja únicamente desde Calendario > Vista Diaria > "Enviar a
// Hoja Reparto" (endpoint POST de más abajo).
// Si se pasa ?fecha=YYYY-MM-DD, solo devuelve los pedidos de ese día
// concreto de reparto (evita que se mezclen varios días enviados a la vez).
// Sin ese parámetro devuelve todos (uso interno / compatibilidad).
app.get('/pedidos/hoja-reparto', async (req, res) => {
  try {
    const { fecha } = req.query;
    const condiciones = ['p.enviado_reparto = true'];
    const valores = [];
    if (fecha) {
      valores.push(fecha);
      condiciones.push(`p.fecha_entrega::date = $${valores.length}::date`);
    }
    const { rows } = await pool.query(`
      SELECT
        p.id, p.dia_reparto, p.fecha_entrega, p.orden_reparto, p.conductor, p.camion, p.observaciones,
        c.apodo AS apodo_cliente, c.telefono, c.zona_reparto AS zona,
        ${SUBQUERY_ITEMS}
      FROM pedidos_calendario p
      JOIN pedidos_historial h ON h.id = p.historial_id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY p.orden_reparto NULLS LAST, p.dia_reparto, c.apodo
    `, valores);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al cargar la hoja de reparto.' });
  }
});

// Lista de días (fecha + nombre del día) que tienen actualmente pedidos
// enviados a la hoja de reparto, para el selector del desplegable.
app.get('/pedidos/hoja-reparto/fechas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT to_char(p.fecha_entrega, 'YYYY-MM-DD') AS fecha, p.dia_reparto
      FROM pedidos_calendario p
      WHERE p.enviado_reparto = true
      ORDER BY fecha
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener los días de la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post('/pedidos/hoja-reparto', async (req, res) => {
  const { ids } = req.body;
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de pedidos.' });
    }
    const { rowCount } = await pool.query(
      `UPDATE pedidos_calendario SET enviado_reparto = true, fecha_envio_reparto = now() WHERE id = ANY($1::int[])`,
      [ids]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'No se encontraron pedidos con los IDs proporcionados en el calendario.' });
    }
    res.json({ success: true, actualizados: rowCount });
  } catch (err) {
    console.error('Error al enviar pedidos a la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud.' });
  }
});

// Edición en línea de un pedido de la hoja: orden de reparto, camión y/o conductor
app.patch('/pedidos/hoja-reparto/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orden_reparto, conductor, camion } = req.body;
    const { rows } = await pool.query(
      `UPDATE pedidos_calendario
       SET orden_reparto = COALESCE($1, orden_reparto),
           conductor     = COALESCE($2, conductor),
           camion        = COALESCE($3, camion)
       WHERE id = $4 AND enviado_reparto = true
       RETURNING id, orden_reparto, conductor, camion`,
      [orden_reparto ?? null, conductor ?? null, camion ?? null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado en la hoja de reparto.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar el pedido de la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Quita un pedido de la hoja de reparto (deja de estar marcado como
// "enviado" y sale de la hoja/impreso), pero SIGUE programado tal cual en
// el calendario, con su fecha y su día. Es distinto de "Volver a
// Pendientes" (más abajo), que sí lo desprograma del todo.
app.delete('/pedidos/hoja-reparto/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE pedidos_calendario
       SET enviado_reparto = false, fecha_envio_reparto = NULL, orden_reparto = NULL
       WHERE id = $1 AND enviado_reparto = true`,
      [id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Pedido no encontrado en la hoja de reparto.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error al quitar el pedido de la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Devuelve por completo un pedido programado a "Pedidos Pendientes de
// Programar", como si nunca se le hubiera puesto fecha (no se queda a
// medias en el calendario): se recrea la fila en pedidos_pendientes con
// los datos actuales del cliente y del pedido, y se borra de
// pedidos_calendario. Funciona esté o no enviado a la hoja de reparto, así
// que sirve tanto desde el Calendario como desde la propia Hoja de Reparto.
app.post('/pedidos_calendario/:id/volver-a-pendientes', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT p.historial_id, p.cliente_id, p.dia_reparto, p.fecha_entrega, p.observaciones,
              c.apodo, c.nombre_completo, c.telefono, c.localidad, c.zona_reparto,
              ${SUBQUERY_ITEMS}
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    const pedido = rows[0];
    if (!pedido) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado en el calendario.' });
    }

    const resumen = resumenItems(pedido.items && pedido.items.length ? pedido.items : []);

    await client.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [pedido.historial_id, pedido.cliente_id, pedido.apodo, pedido.nombre_completo, pedido.telefono, pedido.localidad, pedido.zona_reparto, resumen, pedido.fecha_entrega, pedido.observaciones, pedido.dia_reparto]
    );

    await client.query('DELETE FROM pedidos_calendario WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al volver el pedido a pendientes:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// Vacía la hoja de reparto (no borra los pedidos programados, solo los saca
// de la hoja). Si se pasa ?fecha=YYYY-MM-DD, solo vacía ese día concreto;
// los demás días enviados se quedan tal cual, con su orden/conductor/camión.
app.delete('/pedidos/hoja-reparto', async (req, res) => {
  try {
    const { fecha } = req.query;
    const condiciones = ['enviado_reparto = true'];
    const valores = [];
    if (fecha) {
      valores.push(fecha);
      condiciones.push(`fecha_entrega::date = $${valores.length}::date`);
    }
    await pool.query(
      `UPDATE pedidos_calendario SET enviado_reparto = false, fecha_envio_reparto = NULL, orden_reparto = NULL WHERE ${condiciones.join(' AND ')}`,
      valores
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al limpiar la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Rutas "limpias": las páginas se pueden pedir sin el .html y la app
// principal se sirve tanto en "/" como en "/inicio", para que la barra de
// direcciones no muestre nunca "index.html", "login.html", etc.
app.get('/inicio', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
