import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

async function ensureHistorialTable() {
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
      CONSTRAINT fk_control_precio_historial_admin_list
        FOREIGN KEY (admin_id) REFERENCES admins(id)
        ON DELETE SET NULL
    )
  `);
}

export async function GET() {
  try {
    await ensureHistorialTable();

    const [rows] = await pool.query(`
      SELECT
        h.id,
        DATE_FORMAT(h.creado_en, '%d/%m/%Y %H:%i') AS fecha,
        IFNULL(a.nombre, 'Admin') AS admin,
        h.costo_por_descarga_antes,
        h.costo_por_descarga_despues,
        h.tipo_cambio_antes,
        h.tipo_cambio_despues,
        h.costo_api_usd_antes,
        h.costo_api_usd_despues,
        h.costo_api_pen_antes,
        h.costo_api_pen_despues,
        h.aplica_desde,
        h.motivo
      FROM control_precio_historial h
      LEFT JOIN admins a ON a.id = h.admin_id
      ORDER BY h.creado_en DESC
      LIMIT 50
    `);

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
