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
// todo lo que sea un archivo estático (HTML/CSS/JS/imágenes) para que el login
// y sus recursos se puedan cargar sin estar ya autenticado. Los datos de
// verdad siempre viajan por rutas de API (sin punto en la ruta), que sí se protegen.
const RUTAS_PUBLICAS = new Set(['/login', '/logout', '/forgot-password', '/reset-password']);
app.use((req, res, next) => {
  if (RUTAS_PUBLICAS.has(req.path) || req.path === '/' || req.path.includes('.')) {
    return next();
  }
  return requireAuth(req, res, next);
});

// --- ENVÍO DE EMAILS (Resend) ---
// Se usa la API HTTP de Resend directamente (fetch nativo de Node) para no
// añadir una dependencia nueva. Hace falta la variable de entorno
// RESEND_API_KEY (ver .env.example / README).
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

async function enviarEmail(destinatario, asunto, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('Falta la variable de entorno RESEND_API_KEY: no se puede enviar el email.');
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Piensos y Cereales Urbano <onboarding@resend.dev>',
        to: [destinatario],
        subject: asunto,
        html,
      }),
    });
    if (!resp.ok) {
      console.error('Resend devolvió un error:', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error al enviar email con Resend:', err.message);
    return false;
  }
}

// Envía un email usando una plantilla creada y publicada en el panel de
// Resend (resend.com/templates), en vez de HTML escrito aquí. `variables`
// debe tener las mismas claves que las variables definidas en esa plantilla
// (ver emails/reset-password-resend-template.html para la de recuperar
// contraseña: NOMBRE, ENLACE, LOGO_URL).
async function enviarEmailConPlantilla(destinatario, templateId, variables) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('Falta la variable de entorno RESEND_API_KEY: no se puede enviar el email.');
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Piensos y Cereales Urbano <onboarding@resend.dev>',
        to: [destinatario],
        template: { id: templateId, variables },
      }),
    });
    if (!resp.ok) {
      console.error('Resend devolvió un error (plantilla):', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error al enviar email con plantilla de Resend:', err.message);
    return false;
  }
}

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

app.get('/me', (req, res) => {
  res.json({
    id: req.usuario.id,
    nombre: req.usuario.nombre,
    nombre_usuario: req.usuario.nombre_usuario,
    rol: req.usuario.rol,
  });
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
      const enlace = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
      const logoUrl = `${req.protocol}://${req.get('host')}/img/logo-empresa.jpg`;

      // Si has creado y publicado la plantilla en resend.com/templates (ver
      // emails/reset-password-resend-template.html) y has puesto su ID en
      // la variable de entorno RESEND_TEMPLATE_ID_RESET, se usa esa
      // plantilla. Si no, se envía el mismo diseño pero con el HTML escrito
      // aquí mismo (emails/reset-password.html) — no hace falta elegir una
      // de las dos formas de antemano, funciona con cualquiera.
      const templateId = process.env.RESEND_TEMPLATE_ID_RESET;
      if (templateId) {
        await enviarEmailConPlantilla(usuario.email, templateId, {
          NOMBRE: usuario.nombre,
          ENLACE: enlace,
          LOGO_URL: logoUrl,
        });
      } else {
        await enviarEmail(
          usuario.email,
          'Recupera tu contraseña — Piensos y Cereales Urbano',
          plantillaEmailReset(usuario.nombre, enlace, logoUrl)
        );
      }
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
app.get('/pedidos/hoja-reparto', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.dia_reparto, p.fecha_entrega, p.orden_reparto, p.conductor, p.camion, p.observaciones,
        c.apodo AS apodo_cliente, c.telefono, c.zona_reparto AS zona,
        ${SUBQUERY_ITEMS}
      FROM pedidos_calendario p
      JOIN pedidos_historial h ON h.id = p.historial_id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.enviado_reparto = true
      ORDER BY p.orden_reparto NULLS LAST, p.dia_reparto, c.apodo
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor al cargar la hoja de reparto.' });
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

// Quita un pedido de la hoja (no borra el pedido programado, solo lo saca de la hoja impresa)
app.delete('/pedidos/hoja-reparto/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pedidos_calendario SET enviado_reparto = false, fecha_envio_reparto = NULL, orden_reparto = NULL WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al quitar el pedido de la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Vacía toda la hoja de reparto (no borra los pedidos programados, solo los saca de la hoja)
app.delete('/pedidos/hoja-reparto', async (req, res) => {
  try {
    await pool.query(
      `UPDATE pedidos_calendario SET enviado_reparto = false, fecha_envio_reparto = NULL, orden_reparto = NULL WHERE enviado_reparto = true`
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al limpiar la hoja de reparto:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}

module.exports = app;
