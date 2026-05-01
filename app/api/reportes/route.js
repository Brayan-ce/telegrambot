import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET() {
  try {
    const [reportes] = await pool.query(`
      SELECT
        r.id,
        r.nombre,
        r.tipo,
        DATE_FORMAT(r.creado_en, '%Y-%m-%d') AS fecha,
        r.formato,
        r.estado,
        r.archivo_url,
        IFNULL(CONCAT(r.tamano_mb, ' MB'), '--') AS tamano
      FROM reportes r
      ORDER BY r.creado_en DESC
      LIMIT 50
    `);

    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) = CURDATE()) AS descargas_hoy,
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS descargas_semana,
        (SELECT COUNT(*) FROM usuarios WHERE estado = 'activo') AS usuarios_activos,
        (SELECT COALESCE(SUM(creditos_usados),0) FROM descargas WHERE DATE(fecha) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS creditos_mes
    `);

    return NextResponse.json({ reportes, stats });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { nombre, tipo, formato } = await request.json();
    const [result] = await pool.query(
      'INSERT INTO reportes (admin_id, nombre, tipo, formato, estado) VALUES (1, ?, ?, ?, ?)',
      [nombre, tipo, formato || 'PDF', 'procesando']
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    await pool.query('DELETE FROM reportes WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
