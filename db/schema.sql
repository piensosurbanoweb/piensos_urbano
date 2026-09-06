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

-- Historial de accesos (quién ha iniciado sesión y cuándo) e historial de
-- cambios (quién ha creado/editado/eliminado qué). Solo visibles en la app
-- para el rol "desarrollador". El propio servidor las crea automáticamente
-- al arrancar si no existen (ver server.js, asegurarTablasHistorial), así
-- que ejecutar esto a mano es opcional.
CREATE TABLE IF NOT EXISTS historial_accesos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_usuario VARCHAR(80),
  nombre VARCHAR(120),
  ip VARCHAR(64),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historial_cambios (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_usuario VARCHAR(80),
  nombre VARCHAR(120),
  accion VARCHAR(30) NOT NULL,
  entidad VARCHAR(60) NOT NULL,
  entidad_id INTEGER,
  detalle TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_accesos_fecha ON historial_accesos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_historial_cambios_fecha ON historial_cambios(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_calendario_fecha ON pedidos_calendario(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_calendario_dia ON pedidos_calendario(dia_reparto);
CREATE INDEX IF NOT EXISTS idx_pedidos_pendientes_historial ON pedidos_pendientes(historial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_historial_cliente ON pedidos_historial(cliente_id);

-- =====================================================================
-- RONDA 10 (seguridad): ROW LEVEL SECURITY en todas las tablas.
--
-- Por qué hace falta aunque el backend (server.js) no se rompa: Supabase
-- expone AUTOMÁTICAMENTE una API REST pública (PostgREST) para cada tabla
-- de tu base de datos en https://TU-PROYECTO.supabase.co/rest/v1/... Esa
-- API usa un rol distinto ("anon"/"authenticated", con su propia API key
-- pública de Supabase) que NO es el mismo que usa tu servidor Express para
-- conectarse por DATABASE_URL. Si esa API key pública llegara a manos de
-- alguien (aunque tú no la uses ni la hayas puesto en el frontend, existe
-- siempre en tu proyecto de Supabase) y RLS está desactivado, esa persona
-- podría leer o modificar TODOS los datos de TODAS las tablas directamente,
-- sin pasar por tu backend ni por el login. Con RLS activado y sin
-- políticas permisivas, esa vía queda bloqueada por completo.
--
-- Tu servidor Express (conexión por DATABASE_URL, con el usuario "postgres"
-- de Supabase) sigue funcionando exactamente igual: ese usuario es el
-- propietario de las tablas y por eso Postgres le deja saltarse RLS
-- automáticamente (esto es un comportamiento estándar de Postgres, no algo
-- que haya que configurar aparte).
--
-- CÓMO APLICARLO: pega y ejecuta este bloque en el SQL Editor de Supabase.
-- CÓMO COMPROBAR QUE NO ROMPE NADA: justo después de ejecutarlo, entra en
-- la app (login, ver clientes, crear un pedido...). Si algo deja de
-- funcionar, ejecuta el bloque de "REVERTIR" que hay más abajo y avisa.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_hoja_reparto ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE camiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_cambios ENABLE ROW LEVEL SECURITY;
-- No se crea ninguna política (CREATE POLICY): con RLS activado y sin
-- políticas, la API pública de Supabase (roles anon/authenticated) no
-- puede leer ni escribir NADA en estas tablas. Es exactamente lo que
-- queremos, porque tu app nunca usa esa API: todo pasa por server.js.

-- REVERTIR (solo si algo se rompe en la app tras ejecutar lo de arriba):
-- ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos_historial DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedido_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos_pendientes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos_calendario DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pedidos_hoja_reparto DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE conductores DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE camiones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE zonas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE historial_accesos DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE historial_cambios DISABLE ROW LEVEL SECURITY;
