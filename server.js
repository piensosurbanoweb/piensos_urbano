const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    const result = await pool.query("SELECT * FROM pedidos_pendientes ORDER BY fecha_programacion DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pedidos pendientes" });
  }
});

app.post("/pedidos_pendientes", async (req, res) => {
  try {
    const { historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones } = req.body;
    const result = await pool.query(
      `INSERT INTO pedidos_pendientes (historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [historial_id, cliente_id, apodo, nombre_completo, telefono, localidad, zona, pedido, fecha_programacion, observaciones]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al insertar pedido pendiente" });
  }
});

app.delete("/pedidos_pendientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM pedidos_pendientes WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar pedido pendiente" });
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
