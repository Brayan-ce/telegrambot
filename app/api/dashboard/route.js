import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET() {
  try {
    const [usuarios] = await pool.query(`
      SELECT u.id, u.first_name AS usuario, u.creditos, u.ultima_actividad
      FROM usuarios u
      WHERE u.estado = 'activo'
      ORDER BY u.ultima_actividad DESC
      LIMIT 20
    `);

    const [descargasRecientes] = await pool.query(`
      SELECT 
        TIME_FORMAT(d.fecha, '%H:%i') AS tiempo,
        CONCAT('@', u.username) AS usuario,
        d.nombre_archivo AS archivo,
        d.tipo,
        d.estado,
        -d.creditos_usados AS creditos
      FROM descargas d
      JOIN usuarios u ON d.usuario_id = u.id
      ORDER BY d.fecha DESC
      LIMIT 20
    `);

    const [[kpis]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) = CURDATE()) AS descargas_hoy,
        (SELECT COUNT(*) FROM usuarios WHERE estado = 'activo') AS usuarios_activos,
        (SELECT COALESCE(SUM(creditos_usados), 0) FROM descargas WHERE DATE(fecha) = CURDATE()) AS creditos_consumidos_hoy,
        (SELECT COALESCE(SUM(creditos), 0) FROM usuarios) AS creditos_disponibles,
        (SELECT COUNT(*) FROM descargas) AS total_descargas,
        (SELECT COUNT(*) FROM descargas WHERE estado = 'exitoso') AS total_exitosas,
        (SELECT COUNT(*) FROM descargas WHERE estado = 'fallido') AS total_fallidas,
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM tickets WHERE estado = 'abierto') AS tickets_abiertos
    `);

    const [ranking] = await pool.query(`
      SELECT 
        u.first_name AS name,
        COUNT(d.id) AS value
      FROM usuarios u
      JOIN descargas d ON d.usuario_id = u.id
      WHERE d.estado = 'exitoso'
      GROUP BY u.id, u.first_name
      ORDER BY value DESC
      LIMIT 7
    `);

    return NextResponse.json({ usuarios, descargasRecientes, kpis, ranking });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
