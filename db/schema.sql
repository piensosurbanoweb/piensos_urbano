-- Esquema Postgres para Piensos Urbano (Supabase)
-- Ejecutar este script una vez en el SQL Editor de Supabase (o via psql)
-- para crear las tablas desde cero. No incluye datos: es un esquema limpio.

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  apodo VARCHAR(120),
  nombre_completo VARCHAR(200),
  telefono VARCHAR(50),
  localidad VARCHAR(120),
  zona_reparto VARCHAR(120),
  observaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  apodo_cliente VARCHAR(120),
  tipo VARCHAR(60),
  dia_semana VARCHAR(20),
  cantidad VARCHAR(60),
  producto VARCHAR(200),
  fecha_entrega DATE,
  observaciones TEXT,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos_historial (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  descripcion TEXT,
  fecha_pedido TIMESTAMPTZ,
  fecha_entrega DATE,
  observaciones TEXT
);

-- Líneas de un pedido (1 pedido -> N productos). Un pedido con pienso de
-- gato y de perro genera 2 filas aquí, ambas con el mismo historial_id, en
-- vez de obligar a crear dos pedidos separados.
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  historial_id INTEGER NOT NULL REFERENCES pedidos_historial(id) ON DELETE CASCADE,
  producto VARCHAR(200) NOT NULL,
  cantidad VARCHAR(60) NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pedido_items_historial ON pedido_items(historial_id);

CREATE TABLE IF NOT EXISTS pedidos_pendientes (
  id SERIAL PRIMARY KEY,
  historial_id INTEGER REFERENCES pedidos_historial(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  apodo VARCHAR(120),
  nombre_completo VARCHAR(200),
  telefono VARCHAR(50),
  localidad VARCHAR(120),
  zona VARCHAR(120),
  pedido VARCHAR(255),
  fecha_programacion DATE,
  observaciones TEXT,
  dia_reparto VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS pedidos_calendario (
  id SERIAL PRIMARY KEY,
  historial_id INTEGER REFERENCES pedidos_historial(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  dia_reparto VARCHAR(20),
  fecha_entrega DATE,
  orden_reparto INTEGER,
  conductor VARCHAR(120),
  camion VARCHAR(120),
  observaciones TEXT,
  enviado_reparto BOOLEAN DEFAULT false,
  fecha_envio_reparto TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pedidos_hoja_reparto (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  cantidad VARCHAR(60),
  producto VARCHAR(200),
  fecha_entrega DATE,
  observaciones TEXT
);

-- Roles: "desarrollador" (superadmin, gestiona a todos), "propietario" (admin,
-- gestiona propietarios y gestores pero nunca a un desarrollador) y "gestor"
-- (gestor autorizado: usa toda la app igual que el propietario, pero no
-- gestiona usuarios ni roles).
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre_usuario VARCHAR(80) UNIQUE NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'gestor' CHECK (rol IN ('desarrollador', 'propietario', 'gestor')),
  activo BOOLEAN NOT NULL DEFAULT true,
  reset_token_hash TEXT,
  reset_token_expira TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conductores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS camiones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS zonas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pedidos_calendario_fecha ON pedidos_calendario(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_calendario_dia ON pedidos_calendario(dia_reparto);
CREATE INDEX IF NOT EXISTS idx_pedidos_pendientes_historial ON pedidos_pendientes(historial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_historial_cliente ON pedidos_historial(cliente_id);
