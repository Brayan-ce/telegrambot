import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

async function ensureControlPrecioTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS control_precio_config (
      id TINYINT PRIMARY KEY,
      costo_por_descarga_usd DECIMAL(10,3) NOT NULL DEFAULT 0.025,
      tipo_cambio DECIMAL(10,3) NOT NULL DEFAULT 3.760,
      costo_api_usd DECIMAL(10,3) NOT NULL DEFAULT 0.094,
      aplica_desde DATETIME DEFAULT CURRENT_TIMESTAMP,
      estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
      recomendacion TEXT,
      actualizado_por INT NULL,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_control_precio_admin
        FOREIGN KEY (actualizado_por) REFERENCES admins(id)
        ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS control_precio_historial (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      costo_por_descarga_antes DECIMAL(10,3) NULL,
      costo_por_descarga_despues DECIMAL(10,3) NOT NULL,
      tipo_cambio_antes DECIMAL(10,3) NULL,
      tipo_cambio_despues DECIMAL(10,3) NOT NULL,
      costo_api_usd_antes DECIMAL(10,3) NULL,
      costo_api_usd_despues DECIMAL(10,3) NOT NULL,
      costo_api_pen_antes DECIMAL(10,3) NULL,
      costo_api_pen_despues DECIMAL(10,3) NOT NULL,
      aplica_desde DATETIME,
      motivo VARCHAR(300),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_control_precio_historial_admin
        FOREIGN KEY (admin_id) REFERENCES admins(id)
        ON DELETE SET NULL
    )
  `);

  await pool.query(`
    INSERT INTO control_precio_config (id, recomendacion)
    VALUES (1, 'Guarda este valor como costo API y ajusta tasa cuando cambie el proveedor.')
    ON DUPLICATE KEY UPDATE id = id
  `);
}

export async function GET() {
  try {
    await ensureControlPrecioTables();

    const [[config]] = await pool.query(`
      SELECT
        c.id,
        c.costo_por_descarga_usd,
        c.tipo_cambio,
        c.costo_api_usd,
        ROUND(c.costo_api_usd * c.tipo_cambio, 3) AS costo_api_pen,
        c.aplica_desde,
        c.estado,
        c.recomendacion,
        c.actualizado_en,
        a.nombre AS actualizado_por
      FROM control_precio_config c
      LEFT JOIN admins a ON a.id = c.actualizado_por
      WHERE c.id = 1
      LIMIT 1
    `);

    const [movimientos] = await pool.query(`
      SELECT
        d.id,
        DATE_FORMAT(d.fecha, '%d/%m') AS fecha,
        CONCAT('@', IFNULL(u.username, u.first_name)) AS usuario,
        CONCAT('Descarga ', IFNULL(d.tipo, '-')) AS accion,
        ROUND(IFNULL(d.creditos_usados, 0) * ?, 3) AS ingreso_usd,
        ROUND(CASE WHEN d.estado = 'exitoso' THEN ? ELSE 0 END, 3) AS egreso_api_usd,
        ROUND(CASE WHEN d.estado = 'exitoso' THEN ? * ? ELSE 0 END, 3) AS egreso_api_pen,
        d.estado
      FROM descargas d
      JOIN usuarios u ON u.id = d.usuario_id
      ORDER BY d.fecha DESC
      LIMIT 12
    `, [Number(config?.costo_por_descarga_usd || 0.025), Number(config?.costo_api_usd || 0.094), Number(config?.costo_api_usd || 0.094), Number(config?.tipo_cambio || 3.76)]);

    const [ranking] = await pool.query(`
      SELECT
        CONCAT(IFNULL(u.first_name, 'Usuario'), IFNULL(CONCAT(' ', u.last_name), '')) AS name,
        COUNT(d.id) AS value,
        COALESCE(SUM(d.creditos_usados), 0) AS creditos
      FROM usuarios u
      JOIN descargas d ON d.usuario_id = u.id
      WHERE d.estado = 'exitoso'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY value DESC
      LIMIT 8
    `);

    const [series] = await pool.query(`
      SELECT
        DATE_FORMAT(fecha_dia, '%d/%m') AS dia,
        SUM(exitosas) AS exitosas,
        SUM(pendientes) AS pendientes,
        SUM(fallidas) AS fallidas
      FROM (
        SELECT
          DATE(d.fecha) AS fecha_dia,
          SUM(d.estado = 'exitoso') AS exitosas,
          SUM(d.estado = 'pendiente') AS pendientes,
          SUM(d.estado = 'fallido') AS fallidas
        FROM descargas d
        WHERE DATE(d.fecha) >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
        GROUP BY DATE(d.fecha)
      ) t
      GROUP BY fecha_dia
      ORDER BY fecha_dia ASC
    `);

    const [historial] = await pool.query(`
      SELECT
        h.id,
        DATE_FORMAT(h.creado_en, '%d/%m/%Y %H:%i') AS fecha,
        IFNULL(a.nombre, 'Admin') AS admin,
        h.costo_por_descarga_despues,
        h.tipo_cambio_despues,
        h.costo_api_usd_despues,
        h.costo_api_pen_despues,
        h.motivo
      FROM control_precio_historial h
      LEFT JOIN admins a ON a.id = h.admin_id
      ORDER BY h.creado_en DESC
      LIMIT 8
    `);

    return NextResponse.json({ config, movimientos, ranking, series, historial });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureControlPrecioTables();

    const body = await request.json();
    const costoPorDescarga = Number(body.costo_por_descarga_usd);
    const tipoCambio = Number(body.tipo_cambio);
    const costoApiUsd = Number(body.costo_api_usd);

    if (!Number.isFinite(costoPorDescarga) || costoPorDescarga <= 0) {
      return NextResponse.json({ error: 'Costo por descarga invalido' }, { status: 400 });
    }
    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      return NextResponse.json({ error: 'Tipo de cambio invalido' }, { status: 400 });
    }
    if (!Number.isFinite(costoApiUsd) || costoApiUsd <= 0) {
      return NextResponse.json({ error: 'Costo API invalido' }, { status: 400 });
    }

    const aplicaDesde = body.aplica_desde || null;
    const estado = body.estado === 'inactivo' ? 'inactivo' : 'activo';
    const motivo = (body.motivo || '').toString().slice(0, 300);
    const adminId = 1;

    const [[anterior]] = await pool.query('SELECT * FROM control_precio_config WHERE id = 1 LIMIT 1');

    await pool.query(`
      UPDATE control_precio_config
      SET
        costo_por_descarga_usd = ?,
        tipo_cambio = ?,
        costo_api_usd = ?,
        aplica_desde = COALESCE(?, aplica_desde),
        estado = ?,
        actualizado_por = ?,
        recomendacion = ?
      WHERE id = 1
    `, [
      costoPorDescarga,
      tipoCambio,
      costoApiUsd,
      aplicaDesde,
      estado,
      adminId,
      body.recomendacion || 'Guarda este valor como costo API y ajusta tasa cuando cambie el proveedor.',
    ]);

    await pool.query(`
      INSERT INTO control_precio_historial (
        admin_id,
        costo_por_descarga_antes,
        costo_por_descarga_despues,
        tipo_cambio_antes,
        tipo_cambio_despues,
        costo_api_usd_antes,
        costo_api_usd_despues,
        costo_api_pen_antes,
        costo_api_pen_despues,
        aplica_desde,
        motivo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      Number(anterior?.costo_por_descarga_usd || 0),
      costoPorDescarga,
      Number(anterior?.tipo_cambio || 0),
      tipoCambio,
      Number(anterior?.costo_api_usd || 0),
      costoApiUsd,
      Number(anterior?.costo_api_usd || 0) * Number(anterior?.tipo_cambio || 0),
      costoApiUsd * tipoCambio,
      aplicaDesde,
      motivo || null,
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
