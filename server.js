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
app.get("/pedidos/pendientes", async (req, res) => {
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


// --- PEDIDOS CALENDARIO ---
app.get("/pedidos_calendario", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pedidos_calendario ORDER BY fecha_reparto, orden_reparto");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pedidos calendario" });
  }
});

app.post("/pedidos_calendario", async (req, res) => {
  try {
    const { historial_id, cliente_id, dia_reparto, fecha_reparto, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto } = req.body;
    const result = await pool.query(
      `INSERT INTO pedidos_calendario (historial_id, cliente_id, dia_reparto, fecha_reparto, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [historial_id, cliente_id, dia_reparto, fecha_reparto, orden_reparto, conductor, camion, observaciones, enviado_reparto, fecha_envio_reparto]
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
app.post("/pedidos/mover-a-calendario/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT historial_id, cliente_id, observaciones, fecha_programacion, dia_reparto, apodo, pedido FROM pedidos_pendientes WHERE historial_id = $1",
      [id]
    );
    const pedido = result.rows[0];

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado o ya programado." });
    }

    if (!pedido.dia_reparto) {
        const pedidoOriginalResult = await pool.query(
          "SELECT dia_semana FROM pedidos WHERE id = $1",
          [pedido.historial_id]
        );
        const diaSemanaOriginal = pedidoOriginalResult.rows[0]?.dia_semana;

        if (!diaSemanaOriginal) {
            console.error('Error: El pedido no tiene un día de la semana asignado.');
            return res.status(400).json({ error: "El pedido no tiene un día de la semana asignado." });
        }
        
        await pool.query(
          "UPDATE pedidos_pendientes SET dia_reparto = $1 WHERE historial_id = $2",
          [diaSemanaOriginal, pedido.historial_id]
        );

        pedido.dia_reparto = diaSemanaOriginal;
    }
    
    await pool.query(
      `INSERT INTO pedidos_calendario (
        historial_id, cliente_id, dia_reparto, fecha_reparto, observaciones
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        pedido.historial_id,
        pedido.cliente_id,
        pedido.dia_reparto,
        pedido.fecha_programacion,
        pedido.observaciones,
      ]
    );

    await pool.query("DELETE FROM pedidos_pendientes WHERE historial_id = $1", [id]);

    res.json({ 
        success: true, 
        message: "Pedido programado con éxito.",
        dia_reparto: pedido.dia_reparto,
        fecha_reparto: pedido.fecha_programacion,
        apodo: pedido.apodo,
        pedido: pedido.pedido
    });

  } catch (err) {
    console.error('Error al mover el pedido al calendario:', err.message);
    res.status(500).json({ error: "Error al programar el pedido en el calendario" });
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
    res.status(500).json({ error: "Error al obtener camiones" });
  }
});

app.post("/camiones", async (req, res) => {
  try {
    const { nombre } = req.body;
    const result = await pool.query(
      "INSERT INTO camiones (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar camión" });
  }
});

app.delete("/camiones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE camiones SET activo=false WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
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
