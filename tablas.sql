-- ============================================================
-- BASE DE DATOS: telegram_bot
-- Dashboard Admin - Bot Descargador Freepik
-- ============================================================

CREATE DATABASE IF NOT EXISTS telegram_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE telegram_bot;

-- ============================================================
-- TABLA: admins
-- Administradores del dashboard web
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    VARCHAR(500),
  creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: usuarios
-- Clientes que usan el bot de Telegram
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id     BIGINT NOT NULL UNIQUE,         -- ID único de Telegram (nunca cambia)
  username        VARCHAR(100),                    -- @username (puede ser null)
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100),
  chat_id         BIGINT NOT NULL,                 -- Para enviarle mensajes
  creditos        INT NOT NULL DEFAULT 0,
  estado          ENUM('activo','inactivo','baneado') DEFAULT 'activo',
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultima_actividad DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: descargas
-- Historial de descargas hechas por el bot
-- ============================================================
CREATE TABLE IF NOT EXISTS descargas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL,
  url_solicitada  TEXT NOT NULL,                   -- URL que envió el usuario
  nombre_archivo  VARCHAR(500),                    -- Nombre del archivo entregado
  tipo            VARCHAR(50),                     -- Vector, PSD, Stock Photo, etc
  tamano_mb       DECIMAL(10,2),                   -- Tamaño en MB
  creditos_usados INT NOT NULL DEFAULT 5,          -- Créditos descontados
  estado          ENUM('exitoso','fallido','pendiente') DEFAULT 'pendiente',
  mensaje_error   TEXT,                            -- Detalle si falló
  fecha           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: recargas
-- Historial de créditos añadidos a usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS recargas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL,
  admin_id        INT,                             -- Qué admin hizo la recarga (null si fue automático)
  creditos        INT NOT NULL,                    -- Cantidad añadida
  creditos_antes  INT NOT NULL,                    -- Saldo antes de la recarga
  creditos_despues INT NOT NULL,                   -- Saldo después
  metodo          VARCHAR(100) DEFAULT 'admin',    -- admin, mercadopago, paypal, etc
  nota            TEXT,                            -- Nota del admin
  fecha           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: tickets
-- Soporte - Tickets de usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL,
  asunto          VARCHAR(300) NOT NULL,
  categoria       ENUM('Descargas','Créditos','Cuenta','Facturación','API','Otro') DEFAULT 'Otro',
  prioridad       ENUM('alta','media','baja') DEFAULT 'media',
  estado          ENUM('abierto','proceso','resuelto','cerrado') DEFAULT 'abierto',
  respuestas      INT DEFAULT 0,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: ticket_respuestas
-- Mensajes dentro de cada ticket
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_respuestas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id       INT NOT NULL,
  admin_id        INT,                             -- null si responde el usuario
  usuario_id      INT,                             -- null si responde el admin
  mensaje         TEXT NOT NULL,
  fecha           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: reportes
-- Reportes generados desde el dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS reportes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  admin_id        INT,
  nombre          VARCHAR(300) NOT NULL,
  tipo            ENUM('Descargas','Usuarios','Créditos','Errores','Rendimiento','Financiero'),
  formato         ENUM('PDF','Excel','CSV') DEFAULT 'PDF',
  estado          ENUM('listo','procesando','error') DEFAULT 'procesando',
  archivo_url     VARCHAR(500),                    -- URL del archivo generado
  tamano_mb       DECIMAL(10,2),
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: control_precio_config
-- Configuración activa de costos del proveedor
-- ============================================================
CREATE TABLE IF NOT EXISTS control_precio_config (
  id                    TINYINT PRIMARY KEY,
  costo_por_descarga_usd DECIMAL(10,3) NOT NULL DEFAULT 0.025,
  tipo_cambio           DECIMAL(10,3) NOT NULL DEFAULT 3.760,
  costo_api_usd         DECIMAL(10,3) NOT NULL DEFAULT 0.094,
  aplica_desde          DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado                ENUM('activo','inactivo') DEFAULT 'activo',
  recomendacion         TEXT,
  actualizado_por       INT,
  actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (actualizado_por) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: control_precio_historial
-- Historial de cambios de precio API y tipo de cambio
-- ============================================================
CREATE TABLE IF NOT EXISTS control_precio_historial (
  id                         INT AUTO_INCREMENT PRIMARY KEY,
  admin_id                   INT,
  costo_por_descarga_antes   DECIMAL(10,3),
  costo_por_descarga_despues DECIMAL(10,3) NOT NULL,
  tipo_cambio_antes          DECIMAL(10,3),
  tipo_cambio_despues        DECIMAL(10,3) NOT NULL,
  costo_api_usd_antes        DECIMAL(10,3),
  costo_api_usd_despues      DECIMAL(10,3) NOT NULL,
  costo_api_pen_antes        DECIMAL(10,3),
  costo_api_pen_despues      DECIMAL(10,3) NOT NULL,
  aplica_desde               DATETIME,
  motivo                     VARCHAR(300),
  creado_en                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- DATOS INICIALES: Admin por defecto
-- Password: admin123 (cambiar en producción)
-- ============================================================
INSERT INTO admins (nombre, email, password_hash) VALUES
('Camilo Admin', 'admin@miapp.com', '$2b$10$EJEMPLO_HASH_CAMBIAR_EN_PRODUCCION');

INSERT INTO control_precio_config (id, recomendacion) VALUES
(1, 'Guarda este valor como costo API y ajusta tasa cuando cambie el proveedor.');

-- ============================================================
-- INDICES para mejor rendimiento en consultas frecuentes
-- ============================================================
CREATE INDEX idx_descargas_usuario ON descargas(usuario_id);
CREATE INDEX idx_descargas_fecha ON descargas(fecha);
CREATE INDEX idx_descargas_estado ON descargas(estado);
CREATE INDEX idx_usuarios_telegram ON usuarios(telegram_id);
CREATE INDEX idx_usuarios_estado ON usuarios(estado);
CREATE INDEX idx_recargas_usuario ON recargas(usuario_id);
CREATE INDEX idx_tickets_estado ON tickets(estado);
CREATE INDEX idx_tickets_usuario ON tickets(usuario_id);
CREATE INDEX idx_control_precio_historial_fecha ON control_precio_historial(creado_en);
