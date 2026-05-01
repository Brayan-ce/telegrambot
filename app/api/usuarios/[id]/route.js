import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const [[usuario]] = await pool.query(`
      SELECT
        u.id,
        u.telegram_id,
        CONCAT(u.first_name, IFNULL(CONCAT(' ', u.last_name), '')) AS nombre,
        u.first_name,
        u.last_name,
        CONCAT('@', IFNULL(u.username, 'sin_username')) AS username,
        u.creditos,
        u.estado,
        u.ultima_actividad,
        u.creado_en,
        (SELECT COUNT(*) FROM descargas d WHERE d.usuario_id = u.id AND d.estado = 'exitoso') AS total_descargas,
        (SELECT COALESCE(SUM(d.creditos_usados),0) FROM descargas d WHERE d.usuario_id = u.id) AS creditos_usados,
        (SELECT COUNT(*) FROM tickets t WHERE t.usuario_id = u.id) AS total_tickets
      FROM usuarios u WHERE u.id = ?
    `, [id]);

    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const [actividad] = await pool.query(`
      SELECT 
        CONCAT('Descargó ', IFNULL(d.nombre_archivo, 'archivo')) AS accion,
        d.fecha,
        'descarga' AS tipo
      FROM descargas d WHERE d.usuario_id = ?
      UNION ALL
      SELECT
        CONCAT('Recibió ', r.creditos, ' créditos') AS accion,
        r.fecha,
        'recarga' AS tipo
      FROM recargas r WHERE r.usuario_id = ?
      ORDER BY fecha DESC
      LIMIT 10
    `, [id, id]);

    return NextResponse.json({ usuario, actividad });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { creditos, estado } = await request.json();
    await pool.query(
      'UPDATE usuarios SET creditos = ?, estado = ? WHERE id = ?',
      [creditos, estado, id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
