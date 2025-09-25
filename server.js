/*const bcrypt = require('bcrypt');
const saltRounds = 10; // Cifra alta, cuanto más alta más segura

// RUTA PARA REGISTRAR UN NUEVO USUARIO (OPCIONAL, PERO ÚTIL)
app.post("/register", async (req, res) => {
    try {
        const { nombre_usuario, contrasena } = req.body;
        const contrasena_hash = await bcrypt.hash(contrasena, saltRounds);
        const result = await pool.query(
            "INSERT INTO usuarios (nombre_usuario, contrasena_hash) VALUES ($1, $2) RETURNING *",
            [nombre_usuario, contrasena_hash]
        );
        res.status(201).json({ message: "Usuario registrado con éxito" });
    } catch (err) {
        console.error("Error al registrar usuario:", err.message);
        res.status(500).json({ error: "Error al registrar usuario" });
    }
});

// RUTA PARA EL INICIO DE SESIÓN
app.post("/login", async (req, res) => {
    try {
        const { nombre_usuario, contrasena } = req.body;
        const result = await pool.query("SELECT * FROM usuarios WHERE nombre_usuario = $1", [nombre_usuario]);
        
        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }
        
        const usuario = result.rows[0];
        const contrasenaEsValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        
        if (!contrasenaEsValida) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }
        
        // Aquí podrías generar un token (JWT) para mantener la sesión
        res.status(200).json({ message: "Inicio de sesión exitoso" });
    } catch (err) {
        console.error("Error en el inicio de sesión:", err.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});*/


const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Permitir peticiones desde otros orígenes
app.use(express.json()); // Para parsear JSON en POST


// 🔑 CONFIGURACIÓN DE CONEXIÓN A POSTGRESQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

// Helper para obtener día de la semana (UTC) en minúsculas y sin acentos
function getDiaRepartoUTC(fechaISO) {
  // fechaISO ejemplo: 'YYYY-MM-DD'
  const d = new Date(fechaISO);
  const nombres = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  const n = d.getUTCDay(); // 0..6 (domingo..sabado)
  return nombres[n];
}

// || RUTAS DE API ||

// --- CLIENTES ---
app.get("/clientes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clientes ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

app.post("/clientes", async (req, res) => {
  try {
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    const result = await pool.query(
      `INSERT INTO clientes (apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar cliente" });
  }
});

app.put("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    const result = await pool.query(
      `UPDATE clientes SET apodo=$1, nombre_completo=$2, telefono=$3, localidad=$4, zona_reparto=$5, observaciones=$6 WHERE id=$7 RETURNING *`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

app.delete("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM clientes WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});


// --- PEDIDOS --
app.post("/pedidos", async (req, res) => {
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
      "SELECT apodo, nombre_completo, telefono, localidad, zona_reparto FROM clientes WHERE id = $1",
      [cliente_id]
    );
    const clienteData = clienteResult.rows[0];

    let diaRepartoCorregido = dia_semana;
    if (!diaRepartoCorregido || diaRepartoCorregido.trim() === '') {
      const pedidoOriginalResult = await pool.query(
        "SELECT dia_semana FROM pedidos WHERE id = $1",
        [newPedidoId]
      );
      diaRepartoCorregido = pedidoOriginalResult.rows[0]?.dia_semana || null;
    }

    const pedidoPendiente = `${cantidad} de ${producto}`;
    await client.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [historialId, cliente_id, clienteData.apodo, clienteData.nombre_completo, clienteData.telefono, clienteData.localidad, clienteData.zona_reparto, pedidoPendiente, fecha_entrega, observaciones, diaRepartoCorregido]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Pedido registrado en todas las tablas." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de pedidos:', err.message);
    res.status(500).json({ error: "Error al registrar el pedido", details: err.message });
  } finally {
    client.release();
  }
});




// --- HISTORIAL DE PEDIDOS ---
app.get("/pedidos_historial/:cliente_id", async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const result = await pool.query(
      "SELECT * FROM pedidos_historial WHERE cliente_id=$1 ORDER BY fecha_pedido DESC LIMIT 5",
      [cliente_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

app.post("/pedidos_historial", async (req, res) => {
  try {
    const { cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones } = req.body;
    const result = await pool.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar pedido historial" });
  }
});


// --- PEDIDOS PENDIENTES ---
app.get("/pedidos_pendientes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pedidos_pendientes ORDER BY fecha_programacion DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pedidos pendientes:', err.message);
    res.status(500).json({ error: "Error al obtener pedidos pendientes" });
  }
});

app.post("/pedidos_pendientes", async (req, res) => {
  try {
    const { historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto } = req.body;
    const result = await pool.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al insertar pedido pendiente:', err.message);
    res.status(500).json({ error: "Error al insertar pedido pendiente" });
  }
});

app.delete("/pedidos_pendientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM pedidos_pendientes WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar pedido pendiente:', err.message);
    res.status(500).json({ error: "Error al eliminar pedido pendiente" });
  }
});


// --- MARCAR PEDIDO COMO PROGRAMADO ---
app.put("/pedidos/programar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE pedidos SET estado = 'programado' WHERE id = $1",
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error al marcar pedido como programado:', err.message);
    res.status(500).json({ error: "Error al actualizar el estado del pedido" });
  }
});

// OBTENER DETALLES DE UN PEDIDO ESPECÍFICO
app.get("/pedidos/detalles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
                p.id,
                p.fecha_entrega AS fecha_entrega,
                -- Derivar cantidad y producto desde la descripción del historial
                split_part(h.descripcion, ' de ', 1) AS cantidad,
                split_part(split_part(h.descripcion, ' - ', 1), ' de ', 2) AS producto,
                p.observaciones,
                c.apodo AS apodo_cliente, c.telefono, c.localidad
            FROM 
                pedidos_calendario p
            JOIN 
                pedidos_historial h ON h.id = p.historial_id
            LEFT JOIN 
                clientes c ON p.cliente_id = c.id
            WHERE 
                p.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      // Si el pedido no se encuentra, devuelve un 404
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al obtener detalles del pedido:", err.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


// --- PEDIDOS CALENDARIO ---
// OBTENER PEDIDOS PARA EL CALENDARIO FILTRADOS POR SEMANA
// OBTENER PEDIDOS PARA EL CALENDARIO
app.get("/pedidos_calendario", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() + (offset * 7) - now.getDay() + (now.getDay() === 0 ? -6 : 1));

    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

    const result = await pool.query(
      `SELECT
                p.id,
                p.dia_reparto,
                p.fecha_entrega AS fecha_reparto,
                c.apodo AS apodo_cliente,
                -- Derivar cantidad y producto desde la descripción del historial
                split_part(h.descripcion, ' de ', 1) AS cantidad,
                split_part(split_part(h.descripcion, ' - ', 1), ' de ', 2) AS producto
            FROM
                pedidos_calendario p
            JOIN
                pedidos_historial h ON h.id = p.historial_id
            JOIN
                clientes c ON p.cliente_id = c.id
            WHERE
                p.fecha_entrega BETWEEN $1 AND $2
            ORDER BY
                p.fecha_entrega`,
      [firstDayOfWeek.toISOString().split('T')[0], lastDayOfWeek.toISOString().split('T')[0]]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Error al obtener pedidos del calendario:', err.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Pedidos diarios por dia_reparto (para vista diaria del frontend)
app.get('/pedidos/diarios/:dia', async (req, res) => {
  try {
    const { dia } = req.params; // esperado: 'lunes'..'domingo' sin acentos
    const result = await pool.query(
      `SELECT
          p.id,
          p.dia_reparto,
          p.fecha_entrega AS fecha_reparto,
          c.apodo AS apodo_cliente,
          split_part(h.descripcion, ' de ', 1) AS cantidad,
          split_part(split_part(h.descripcion, ' - ', 1), ' de ', 2) AS producto,
          p.observaciones
        FROM pedidos_calendario p
        JOIN pedidos_historial h ON h.id = p.historial_id
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.dia_reparto = $1
        ORDER BY p.fecha_entrega, c.apodo`,
      [dia]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pedidos diarios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post("/pedidos_calendario", async (req, res) => {
  try {
    const { historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const result = await pool.query(
      `INSERT INTO pedidos_calendario (historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar pedido calendario" });
  }
});


app.put("/pedidos_calendario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const result = await pool.query(
      `UPDATE pedidos_calendario SET orden_reparto=$1, conductor=$2, camion=$3, observaciones=$4, enviado_reparto=$5, fecha_envio_reparto=$6 WHERE id=$7 RETURNING *`,
      [orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar pedido calendario" });
  }
});

app.delete("/pedidos_calendario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM pedidos_calendario WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar pedido calendario" });
  }
});


// Ruta para mover un pedido de pendientes a calendario
app.post("/pedidos/programar-con-fecha/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { fecha } = req.body;

    // Obtener los datos del pedido pendiente
    const result = await client.query(
      "SELECT historial_id, cliente_id, observaciones, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = $1",
      [id]
    );
    const pedido = result.rows[0];

    if (!pedido) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    // Obtener nombre de día normalizado (sin acentos) en UTC
    const diaDeLaSemana = getDiaRepartoUTC(fecha);

    // Insertar en la tabla de 'pedidos_calendario' (fuente de verdad de la programación)
    await client.query(
      `INSERT INTO pedidos_calendario (
        historial_id, cliente_id, dia_reparto, fecha_entrega, observaciones
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        pedido.historial_id,
        pedido.cliente_id,
        diaDeLaSemana,
        fecha,
        pedido.observaciones,
      ]
    );

    // Eliminar de la tabla de pendientes
    await client.query("DELETE FROM pedidos_pendientes WHERE historial_id = $1", [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Pedido programado con éxito.",
      dia_reparto: diaDeLaSemana,
      fecha_entrega: fecha,
      fecha_reparto: fecha,
      apodo: pedido.apodo,
      pedido: pedido.pedido
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de programación:', err.message);
    res.status(500).json({ error: "Error al programar el pedido" });
  } finally {
    client.release();
  }
});

// Alias para compatibilidad con el frontend actual
app.post("/pedidos/mover-a-calendario/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { fecha } = req.body;

    // Obtener los datos del pedido pendiente
    const result = await client.query(
      "SELECT historial_id, cliente_id, observaciones, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = $1",
      [id]
    );
    const pedido = result.rows[0];

    if (!pedido) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    // Obtener nombre de día normalizado (sin acentos) en UTC
    const diaDeLaSemana = getDiaRepartoUTC(fecha);

    // Insertar en la tabla de 'pedidos_calendario' (fuente de verdad de la programación)
    await client.query(
      `INSERT INTO pedidos_calendario (
        historial_id, cliente_id, dia_reparto, fecha_entrega, observaciones
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        pedido.historial_id,
        pedido.cliente_id,
        diaDeLaSemana,
        fecha,
        pedido.observaciones,
      ]
    );

    // Eliminar de la tabla de pendientes
    await client.query("DELETE FROM pedidos_pendientes WHERE historial_id = $1", [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Pedido programado con éxito.",
      dia_reparto: diaDeLaSemana,
      fecha_entrega: fecha,
      fecha_reparto: fecha,
      apodo: pedido.apodo,
      pedido: pedido.pedido
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en la transacción de programación:', err.message);
    res.status(500).json({ error: "Error al programar el pedido" });
  } finally {
    client.release();
  }
});


// --- CONDUCTORES ---
app.get("/conductores", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM conductores WHERE activo=true ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener conductores" });
  }
});

app.post("/conductores", async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      "INSERT INTO conductores (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar conductor" });
  }
});

app.delete("/conductores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE conductores SET activo=false WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar conductor" });
  }
});

// --- CAMIONES ---
app.get("/camiones", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM camiones WHERE activo=true ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener camiones" });
  }
});

app.post("/camiones", async (req, res) => {
  try {
    // El frontend ya envía la propiedad 'matricula', no hay que cambiarla aquí.
    const { matricula } = req.body;

    if (!matricula) {
      return res.status(400).json({ error: "La matrícula es requerida." });
    }

    // Cambia la columna 'nombre' a 'matricula' en la consulta SQL
    // para que coincida con tu base de datos o usa el campo 'nombre'
    // de tu base de datos y la variable 'matricula' que te llega del front-end.
    const result = await pool.query(
      "INSERT INTO camiones (nombre) VALUES ($1) RETURNING *",
      [matricula] // Usa la variable 'matricula' que recibiste
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al insertar camión:", err);
    res.status(500).json({ error: "Error al insertar camión." });
  }
});

// La ruta para eliminar camiones, esta está correcta
app.delete("/camiones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE camiones SET activo=false WHERE id=$1", [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error al eliminar camión:", err);
    res.status(500).json({ error: "Error al eliminar camión" });
  }
});

// --- ZONAS ---
app.get("/zonas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM zonas WHERE activa=true ORDER BY nombre");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener zonas" });
  }
});

app.post("/zonas", async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      "INSERT INTO zonas (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar zona" });
  }
});

app.delete("/zonas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE zonas SET activa=false WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar zona" });
  }
});

// EDITAR FECHA DE LOS PEDIDOS DE CALENDARIO
// EDITAR FECHA DE LOS PEDIDOS DE CALENDARIO
app.patch("/pedidos/editar-fecha/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha } = req.body;
        
        const date = new Date(fecha + 'T00:00:00');
        const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const nuevoDia = diasSemana[date.getUTCDay()];

        const result = await pool.query(
            `UPDATE pedidos_calendario
             SET fecha_entrega = $1, dia_reparto = $2
             WHERE id = $3
             RETURNING *`,
            [fecha, nuevoDia, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        res.json(result.rows[0]);

    } catch (err) {
        console.error('Error al actualizar la fecha del pedido:', err.message);
        res.status(500).json({ error: "Error al actualizar la fecha del pedido" });
    }
});


// --- FUNCIONES DE HOJA DE REPARTO ---
// OBTENER PEDIDOS PARA LA HOJA DE REPARTO
app.get("/pedidos/hoja-reparto", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.cantidad, p.producto, p.fecha_entrega,
        c.apodo AS apodo_cliente
      FROM 
        pedidos_hoja_reparto p
      JOIN 
        clientes c ON p.cliente_id = c.id
      ORDER BY
        p.fecha_entrega, c.apodo;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pedidos de la hoja de reparto:', err.message);
    res.status(500).json({ error: "Error interno del servidor al cargar la hoja de reparto." });
  }
});

// AGREGAR PEDIDOS A LA HOJA DE REPARTO
app.post("/pedidos/hoja-reparto", async (req, res) => {
  const { ids } = req.body;
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de IDs de pedidos." });
    }

    // Consulta los pedidos del calendario junto con el apodo del cliente
    const queryPedidos = `
  SELECT
      p.id,
      p.cliente_id,
      split_part(h.descripcion, ' de ', 1) AS cantidad,
      split_part(split_part(h.descripcion, ' - ', 1), ' de ', 2) AS producto,
      p.fecha_entrega AS fecha_entrega,
      p.observaciones,
      c.apodo AS apodo_cliente
  FROM
      pedidos_calendario p
  JOIN
      pedidos_historial h ON h.id = p.historial_id
  JOIN
      clientes c ON p.cliente_id = c.id
  WHERE
      p.id = ANY($1::int[])
`;

    const resultPedidos = await pool.query(queryPedidos, [ids]);

    if (resultPedidos.rowCount === 0) {
      return res.status(404).json({ error: "No se encontraron pedidos con los IDs proporcionados en el calendario." });
    }

    // Prepara los datos para la inserción en la tabla de hoja de reparto
    const pedidosAInsertar = resultPedidos.rows;

    const queryInsert = `
      INSERT INTO pedidos_hoja_reparto (id, cliente_id, cantidad, producto, fecha_entrega, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING;
    `;

    // Inserta cada pedido en la tabla de hoja de reparto
    for (const pedido of pedidosAInsertar) {
      await pool.query(queryInsert, [
        pedido.id,
        pedido.cliente_id,
        pedido.cantidad,
        pedido.producto,
        pedido.fecha_entrega,
        pedido.observaciones
      ]);
    }

    // Ahora, obtén la lista completa de pedidos en la hoja de reparto para devolverla al frontend
    const resultFinal = await pool.query(`
      SELECT 
        p.id, p.cantidad, p.producto, p.fecha_entrega,
        c.apodo AS apodo_cliente
      FROM 
        pedidos_hoja_reparto p
      JOIN 
        clientes c ON p.cliente_id = c.id
      ORDER BY
        p.fecha_entrega, c.apodo;
    `);

    res.json(resultFinal.rows);

  } catch (err) {
    console.error('Error al agregar pedidos a la hoja de reparto:', err.message);
    res.status(500).json({ error: "Error interno del servidor al procesar la solicitud." });
  }
});


// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Esto asegura que cualquier ruta no encontrada devuelva index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
