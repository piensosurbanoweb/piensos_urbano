// Entrypoint único para Vercel (zero-config Express) y para desarrollo local
// (`npm start`). Vercel importa este archivo (module.exports = app) sin
// ejecutar app.listen; en local, node server.js sí lo ejecuta.

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

// Conexión a Postgres (Supabase). La cadena de conexión se define en la
// variable de entorno DATABASE_URL (en Vercel: Project Settings -> Environment
// Variables; en local: archivo .env, ver .env.example).
if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL. Consulta .env.example / README.md.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requiere SSL
});

// Helper para obtener día de la semana (UTC)
function getDiaRepartoUTC(fechaISO) {
  const d = new Date(fechaISO);
  const nombres = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const n = d.getUTCDay();
  return nombres[n];
}

// Equivalente en JS a lo que antes hacía MySQL con SUBSTRING_INDEX sobre
// descripcion = "${cantidad} de ${producto} - ${apodo_cliente}"
function parseDescripcion(descripcion) {
  const antesGuion = (descripcion || '').split(' - ')[0];
  const partes = antesGuion.split(' de ');
  const cantidad = partes[0] || '';
  const producto = partes.length > 1 ? partes[partes.length - 1] : '';
  return { cantidad, producto };
}

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
app.post('/pedidos', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones } = req.body;

    const pedidoResult = await client.query(
      `INSERT INTO pedidos (cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, fecha_creacion`,
      [cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones]
    );
    const newPedidoId = pedidoResult.rows[0].id;
    const fechaPedido = pedidoResult.rows[0].fecha_creacion;

    const descripcion = `${cantidad} de ${producto} - ${apodo_cliente}`;
    const historialResult = await client.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [cliente_id, descripcion, fechaPedido, fecha_entrega, observaciones]
    );
    const historialId = historialResult.rows[0].id;

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

    const pedidoPendiente = `${cantidad} de ${producto}`;
    await client.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [historialId, cliente_id, clienteData.apodo, clienteData.nombre_completo, clienteData.telefono, clienteData.localidad, clienteData.zona_reparto, pedidoPendiente, fecha_entrega, observaciones, diaRepartoCorregido]
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
app.get('/pedidos_historial/:cliente_id', async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM pedidos_historial WHERE cliente_id=$1 ORDER BY fecha_pedido DESC LIMIT 5',
      [cliente_id]
    );
    // Se añaden cantidad/producto ya extraídos de "descripcion" para que el
    // frontend pueda mostrar y reutilizar directamente los últimos pedidos
    // del cliente (ver Nuevo Pedido).
    const resultado = rows.map(({ descripcion, ...resto }) => ({ ...resto, descripcion, ...parseDescripcion(descripcion) }));
    res.json(resultado);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener historial' });
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
         h.descripcion,
         p.observaciones,
         c.apodo AS apodo_cliente, c.telefono, c.localidad
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const { cantidad, producto } = parseDescripcion(rows[0].descripcion);
    const { descripcion, ...resto } = rows[0];
    res.json({ ...resto, cantidad, producto });
  } catch (err) {
    console.error('Error al obtener detalles del pedido:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- PEDIDOS CALENDARIO ---
app.get('/pedidos_calendario', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() + offset * 7 - now.getDay() + (now.getDay() === 0 ? -6 : 1));

    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.dia_reparto,
         p.fecha_entrega AS fecha_reparto,
         c.apodo AS apodo_cliente,
         h.descripcion
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       JOIN clientes c ON p.cliente_id = c.id
       WHERE p.fecha_entrega BETWEEN $1 AND $2
       ORDER BY p.fecha_entrega`,
      [firstDayOfWeek.toISOString().split('T')[0], lastDayOfWeek.toISOString().split('T')[0]]
    );

    const resultado = rows.map(({ descripcion, ...resto }) => ({ ...resto, ...parseDescripcion(descripcion) }));
    res.json(resultado);
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
         h.descripcion,
         p.observaciones
       FROM pedidos_calendario p
       JOIN pedidos_historial h ON h.id = p.historial_id
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.dia_reparto = $1
       ORDER BY p.fecha_entrega, c.apodo`,
      [dia]
    );
    const resultado = rows.map(({ descripcion, ...resto }) => ({ ...resto, ...parseDescripcion(descripcion) }));
    res.json(resultado);
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
        h.descripcion
      FROM pedidos_calendario p
      JOIN pedidos_historial h ON h.id = p.historial_id
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.enviado_reparto = true
      ORDER BY p.orden_reparto NULLS LAST, p.dia_reparto, c.apodo
    `);
    const resultado = rows.map(({ descripcion, ...resto }) => ({ ...resto, ...parseDescripcion(descripcion) }));
    res.json(resultado);
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
