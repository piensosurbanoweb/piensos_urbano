/*const bcrypt = require('bcrypt');
const saltRounds = 10; // Cifra alta, cuanto más alta más segura

// RUTA PARA REGISTRAR UN NUEVO USUARIO (OPCIONAL, PERO ÚTIL)
app.post("/register", async (req, res) => {
    try {
        const { nombre_usuario, contrasena } = req.body;
        const contrasena_hash = await bcrypt.hash(contrasena, saltRounds);
        const [result] = await pool.query(
            "INSERT INTO usuarios (nombre_usuario, contrasena_hash) VALUES (?, ?)",
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
        const [rows] = await pool.query("SELECT * FROM usuarios WHERE nombre_usuario = ?", [nombre_usuario]);
        
        if (rows.length === 0) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }
        
        const usuario = rows[0];
        const contrasenaEsValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        
        if (!contrasenaEsValida) {
            return res.status(401).json({ error: "Credenciales incorrectas" });
        }
        
        res.status(200).json({ message: "Inicio de sesión exitoso" });
    } catch (err) {
        console.error("Error en el inicio de sesión:", err.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});*/


const path = require('path');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

// Configuración de la conexión (asegúrate de que esto reemplaza a lo que tienes en la línea 58)
const pool = mysql.createPool({
  host: '127.0.0.1', 
  user: 'piensos_user',
  password: 'Proyecto2025-',
  database: 'piensos_urbano',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper para obtener día de la semana (UTC)
function getDiaRepartoUTC(fechaISO) {
  const d = new Date(fechaISO);
  const nombres = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  const n = d.getUTCDay(); 
  return nombres[n];
}

// || RUTAS DE API ||

// --- CLIENTES ---
app.get("/clientes", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM clientes ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

app.post("/clientes", async (req, res) => {
  try {
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    const [result] = await pool.query(
      `INSERT INTO clientes (apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones]
    );
    const [newClient] = await pool.query("SELECT * FROM clientes WHERE id = ?", [result.insertId]);
    res.json(newClient[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar cliente" });
  }
});

app.put("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones } = req.body;
    await pool.query(
      `UPDATE clientes SET apodo=?, nombre_completo=?, telefono=?, localidad=?, zona_reparto=?, observaciones=? WHERE id=?`,
      [apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones, id]
    );
    const [updatedClient] = await pool.query("SELECT * FROM clientes WHERE id = ?", [id]);
    res.json(updatedClient[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

app.delete("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM clientes WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
});


// --- PEDIDOS --
app.post("/pedidos", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones } = req.body;

    const [pedidoResult] = await connection.query(
      `INSERT INTO pedidos (cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cliente_id, apodo_cliente, tipo, dia_semana, cantidad, producto, fecha_entrega, observaciones]
    );
    const newPedidoId = pedidoResult.insertId;
    
    // Obtenemos la fecha de creacion que MYSQL generó por defecto
    const [pedidoCreado] = await connection.query("SELECT fecha_creacion FROM pedidos WHERE id = ?", [newPedidoId]);
    const fechaPedido = pedidoCreado[0].fecha_creacion;

    const descripcion = `${cantidad} de ${producto} - ${apodo_cliente}`;
    const [historialResult] = await connection.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES (?, ?, ?, ?, ?)`,
      [cliente_id, descripcion, fechaPedido, fecha_entrega, observaciones]
    );
    const historialId = historialResult.insertId;

    const [clienteResult] = await connection.query(
      "SELECT apodo, nombre_completo, telefono, localidad, zona_reparto FROM clientes WHERE id = ?",
      [cliente_id]
    );
    const clienteData = clienteResult[0];

    let diaRepartoCorregido = dia_semana;
    if (!diaRepartoCorregido || diaRepartoCorregido.trim() === '') {
      const [pedidoOriginalResult] = await connection.query(
        "SELECT dia_semana FROM pedidos WHERE id = ?",
        [newPedidoId]
      );
      diaRepartoCorregido = pedidoOriginalResult[0]?.dia_semana || null;
    }

    const pedidoPendiente = `${cantidad} de ${producto}`;
    await connection.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [historialId, cliente_id, clienteData.apodo, clienteData.nombre_completo, clienteData.telefono, clienteData.localidad, clienteData.zona_reparto, pedidoPendiente, fecha_entrega, observaciones, diaRepartoCorregido]
    );

    await connection.commit();
    res.json({ success: true, message: "Pedido registrado en todas las tablas." });

  } catch (err) {
    await connection.rollback();
    console.error('Error en la transacción de pedidos:', err.message);
    res.status(500).json({ error: "Error al registrar el pedido", details: err.message });
  } finally {
    connection.release();
  }
});


// --- HISTORIAL DE PEDIDOS ---
app.get("/pedidos_historial/:cliente_id", async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM pedidos_historial WHERE cliente_id=? ORDER BY fecha_pedido DESC LIMIT 5",
      [cliente_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

app.post("/pedidos_historial", async (req, res) => {
  try {
    const { cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones } = req.body;
    const [result] = await pool.query(
      `INSERT INTO pedidos_historial (cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones)
       VALUES (?, ?, ?, ?, ?)`,
      [cliente_id, descripcion, fecha_pedido, fecha_entrega, observaciones]
    );
    const [newHistorial] = await pool.query("SELECT * FROM pedidos_historial WHERE id = ?", [result.insertId]);
    res.json(newHistorial[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar pedido historial" });
  }
});


// --- PEDIDOS PENDIENTES ---
app.get("/pedidos_pendientes", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM pedidos_pendientes ORDER BY fecha_programacion DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos pendientes:', err.message);
    res.status(500).json({ error: "Error al obtener pedidos pendientes" });
  }
});

app.get("/pedidos/pendientes", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id, historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona,
                pedido, fecha_programacion, observaciones, dia_reparto
            FROM 
                pedidos_pendientes
            ORDER BY 
                dia_reparto, apodo;
        `);
        res.json(rows);
    } catch (err) {
        console.error("Error al obtener pedidos pendientes:", err.message);
        res.status(500).json({ error: "Error al obtener pedidos pendientes." });
    }
});

app.post("/pedidos_pendientes", async (req, res) => {
  try {
    const { historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto } = req.body;
    const [result] = await pool.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones, dia_reparto]
    );
    const [newPendiente] = await pool.query("SELECT * FROM pedidos_pendientes WHERE id = ?", [result.insertId]);
    res.json(newPendiente[0]);
  } catch (err) {
    console.error('Error al insertar pedido pendiente:', err.message);
    res.status(500).json({ error: "Error al insertar pedido pendiente" });
  }
});

app.delete("/pedidos_pendientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM pedidos_pendientes WHERE id=?", [id]);
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
      "UPDATE pedidos SET estado = 'programado' WHERE id = ?",
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
    const [rows] = await pool.query(
      `SELECT 
                p.id,
                p.fecha_entrega AS fecha_entrega,
                SUBSTRING_INDEX(h.descripcion, ' de ', 1) AS cantidad,
                SUBSTRING_INDEX(SUBSTRING_INDEX(h.descripcion, ' - ', 1), ' de ', -1) AS producto,
                p.observaciones,
                c.apodo AS apodo_cliente, c.telefono, c.localidad
            FROM 
                pedidos_calendario p
            JOIN 
                pedidos_historial h ON h.id = p.historial_id
            LEFT JOIN 
                clientes c ON p.cliente_id = c.id
            WHERE 
                p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error al obtener detalles del pedido:", err.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


// --- PEDIDOS CALENDARIO ---
app.get("/pedidos_calendario", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() + (offset * 7) - now.getDay() + (now.getDay() === 0 ? -6 : 1));

    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

    const [rows] = await pool.query(
      `SELECT
                p.id,
                p.dia_reparto,
                p.fecha_entrega AS fecha_reparto,
                c.apodo AS apodo_cliente,
                SUBSTRING_INDEX(h.descripcion, ' de ', 1) AS cantidad,
                SUBSTRING_INDEX(SUBSTRING_INDEX(h.descripcion, ' - ', 1), ' de ', -1) AS producto
            FROM
                pedidos_calendario p
            JOIN
                pedidos_historial h ON h.id = p.historial_id
            JOIN
                clientes c ON p.cliente_id = c.id
            WHERE
                p.fecha_entrega BETWEEN ? AND ?
            ORDER BY
                p.fecha_entrega`,
      [firstDayOfWeek.toISOString().split('T')[0], lastDayOfWeek.toISOString().split('T')[0]]
    );

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener pedidos del calendario:', err.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Pedidos diarios por dia_reparto
app.get('/pedidos/diarios/:dia', async (req, res) => {
  try {
    const { dia } = req.params; 
    const [rows] = await pool.query(
      `SELECT
          p.id,
          p.dia_reparto,
          p.fecha_entrega AS fecha_reparto,
          c.apodo AS apodo_cliente,
          SUBSTRING_INDEX(h.descripcion, ' de ', 1) AS cantidad,
          SUBSTRING_INDEX(SUBSTRING_INDEX(h.descripcion, ' - ', 1), ' de ', -1) AS producto,
          p.observaciones
        FROM pedidos_calendario p
        JOIN pedidos_historial h ON h.id = p.historial_id
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.dia_reparto = ?
        ORDER BY p.fecha_entrega, c.apodo`,
      [dia]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos diarios:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post("/pedidos_calendario", async (req, res) => {
  try {
    const { historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const [result] = await pool.query(
      `INSERT INTO pedidos_calendario (historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [historial_id, cliente_id, dia_reparto, fecha_entrega, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto]
    );
    const [newCal] = await pool.query("SELECT * FROM pedidos_calendario WHERE id = ?", [result.insertId]);
    res.json(newCal[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar pedido calendario" });
  }
});


app.put("/pedidos_calendario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    await pool.query(
      `UPDATE pedidos_calendario SET orden_reparto=?, conductor=?, camion=?, observaciones=?, enviado_reparto=?, fecha_envio_reparto=? WHERE id=?`,
      [orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto, id]
    );
    const [updatedCal] = await pool.query("SELECT * FROM pedidos_calendario WHERE id = ?", [id]);
    res.json(updatedCal[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar pedido calendario" });
  }
});

app.delete("/pedidos_calendario/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM pedidos_calendario WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar pedido calendario" });
  }
});


// Ruta para mover un pedido de pendientes a calendario
app.post("/pedidos/programar-con-fecha/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { fecha } = req.body;

    const [result] = await connection.query(
      "SELECT historial_id, cliente_id, observaciones, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = ?",
      [id]
    );
    const pedido = result[0];

    if (!pedido) {
      await connection.rollback();
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    const diaDeLaSemana = getDiaRepartoUTC(fecha);

    await connection.query(
      `INSERT INTO pedidos_calendario (
        historial_id, cliente_id, dia_reparto, fecha_entrega, observaciones
      ) VALUES (?, ?, ?, ?, ?)`,
      [pedido.historial_id, pedido.cliente_id, diaDeLaSemana, fecha, pedido.observaciones]
    );

    await connection.query("DELETE FROM pedidos_pendientes WHERE historial_id = ?", [id]);

    await connection.commit();

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
    await connection.rollback();
    console.error('Error en la transacción de programación:', err.message);
    res.status(500).json({ error: "Error al programar el pedido" });
  } finally {
    connection.release();
  }
});

// Alias para compatibilidad con el frontend actual
app.post("/pedidos/mover-a-calendario/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { fecha } = req.body;

    const [result] = await connection.query(
      "SELECT historial_id, cliente_id, observaciones, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = ?",
      [id]
    );
    const pedido = result[0];

    if (!pedido) {
      await connection.rollback();
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    const diaDeLaSemana = getDiaRepartoUTC(fecha);

    await connection.query(
      `INSERT INTO pedidos_calendario (
        historial_id, cliente_id, dia_reparto, fecha_entrega, observaciones
      ) VALUES (?, ?, ?, ?, ?)`,
      [pedido.historial_id, pedido.cliente_id, diaDeLaSemana, fecha, pedido.observaciones]
    );

    await connection.query("DELETE FROM pedidos_pendientes WHERE historial_id = ?", [id]);

    await connection.commit();

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
    await connection.rollback();
    console.error('Error en la transacción de programación:', err.message);
    res.status(500).json({ error: "Error al programar el pedido" });
  } finally {
    connection.release();
  }
});


// --- CONDUCTORES ---
app.get("/conductores", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM conductores WHERE activo=true ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener conductores" });
  }
});

app.post("/conductores", async (req, res) => {
  try {
    const { nombre } = req.body;
    const [result] = await pool.query(
      "INSERT INTO conductores (nombre) VALUES (?)",
      [nombre]
    );
    const [newCond] = await pool.query("SELECT * FROM conductores WHERE id = ?", [result.insertId]);
    res.json(newCond[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar conductor" });
  }
});

app.delete("/conductores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE conductores SET activo=false WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar conductor" });
  }
});

// --- CAMIONES ---
app.get("/camiones", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM camiones WHERE activo=true ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener camiones" });
  }
});

app.post("/camiones", async (req, res) => {
  try {
    const { matricula } = req.body;
    if (!matricula) {
      return res.status(400).json({ error: "La matrícula es requerida." });
    }
    const [result] = await pool.query(
      "INSERT INTO camiones (nombre) VALUES (?)",
      [matricula] 
    );
    const [newCamion] = await pool.query("SELECT * FROM camiones WHERE id = ?", [result.insertId]);
    res.status(201).json(newCamion[0]);
  } catch (err) {
    console.error("Error al insertar camión:", err);
    res.status(500).json({ error: "Error al insertar camión." });
  }
});

app.delete("/camiones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE camiones SET activo=false WHERE id=?", [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error al eliminar camión:", err);
    res.status(500).json({ error: "Error al eliminar camión" });
  }
});

// --- ZONAS ---
app.get("/zonas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM zonas WHERE activa=true ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener zonas" });
  }
});

app.post("/zonas", async (req, res) => {
  try {
    const { nombre } = req.body;
    const [result] = await pool.query(
      "INSERT INTO zonas (nombre) VALUES (?)",
      [nombre]
    );
    const [newZona] = await pool.query("SELECT * FROM zonas WHERE id = ?", [result.insertId]);
    res.json(newZona[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar zona" });
  }
});

app.delete("/zonas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE zonas SET activa=false WHERE id=?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar zona" });
  }
});

// EDITAR FECHA DE LOS PEDIDOS DE CALENDARIO
app.patch("/pedidos/editar-fecha/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha } = req.body;

    const nuevoDia = getDiaRepartoUTC(fecha);

    const [result] = await pool.query(
      `UPDATE pedidos_calendario
             SET fecha_entrega = ?, dia_reparto = ?
             WHERE id = ?`,
      [fecha, nuevoDia, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    
    const [updatedPed] = await pool.query("SELECT * FROM pedidos_calendario WHERE id = ?", [id]);
    res.json(updatedPed[0]);

  } catch (err) {
    console.error('Error al actualizar la fecha del pedido:', err.message);
    res.status(500).json({ error: "Error al actualizar la fecha del pedido" });
  }
});


// --- FUNCIONES DE HOJA DE REPARTO ---
app.get("/pedidos/hoja-reparto", async (req, res) => {
  try {
    const [rows] = await pool.query(`
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
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener pedidos de la hoja de reparto:', err.message);
    res.status(500).json({ error: "Error interno del servidor al cargar la hoja de reparto." });
  }
});

app.post("/pedidos/hoja-reparto", async (req, res) => {
  const { ids } = req.body;
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de IDs de pedidos." });
    }

    const queryPedidos = `
  SELECT
      p.id,
      p.cliente_id,
      SUBSTRING_INDEX(h.descripcion, ' de ', 1) AS cantidad,
      SUBSTRING_INDEX(SUBSTRING_INDEX(h.descripcion, ' - ', 1), ' de ', -1) AS producto,
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
      p.id IN (?)
`;

    // Con MySQL, pasamos el array directamente a IN (?)
    const [resultPedidos] = await pool.query(queryPedidos, [ids]);

    if (resultPedidos.length === 0) {
      return res.status(404).json({ error: "No se encontraron pedidos con los IDs proporcionados en el calendario." });
    }

    const pedidosAInsertar = resultPedidos;

    // MySQL usa INSERT IGNORE en lugar de ON CONFLICT
    const queryInsert = `
      INSERT IGNORE INTO pedidos_hoja_reparto (id, cliente_id, cantidad, producto, fecha_entrega, observaciones)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

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

    const [resultFinal] = await pool.query(`
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

    res.json(resultFinal);

  } catch (err) {
    console.error('Error al agregar pedidos a la hoja de reparto:', err.message);
    res.status(500).json({ error: "Error interno del servidor al procesar la solicitud." });
  }
});


// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});