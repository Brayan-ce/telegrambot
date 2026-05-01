import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || null;
    const tipo = searchParams.get('tipo') || null;
    const desde = searchParams.get('desde') || null;
    const hasta = searchParams.get('hasta') || null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (estado) { where.push('d.estado = ?'); params.push(estado); }
    if (tipo) { where.push('d.tipo = ?'); params.push(tipo); }
    if (desde) { where.push('DATE(d.fecha) >= ?'); params.push(desde); }
    if (hasta) { where.push('DATE(d.fecha) <= ?'); params.push(hasta); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [descargas] = await pool.query(`
      SELECT 
        d.id,
        DATE_FORMAT(d.fecha, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(d.fecha, '%H:%i') AS hora,
        COALESCE(CONCAT('@', u.username), u.first_name) AS usuario,
        d.nombre_archivo AS archivo,
        d.tipo,
        CONCAT(d.tamano_mb, ' MB') AS tamano,
        d.estado,
        -d.creditos_usados AS creditos
      FROM descargas d
      JOIN usuarios u ON d.usuario_id = u.id
      ${whereClause}
      ORDER BY d.fecha DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) AS total FROM descargas d ${whereClause}
    `, params);

    const [[kpis]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) = CURDATE()) AS descargas_hoy,
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) = CURDATE() AND estado = 'exitoso') AS exitosas,
        (SELECT COUNT(*) FROM descargas WHERE DATE(fecha) = CURDATE() AND estado = 'fallido') AS fallidas,
        (SELECT COALESCE(SUM(tamano_mb), 0) FROM descargas WHERE DATE(fecha) = CURDATE()) AS datos_gb
    `);

    return NextResponse.json({ descargas, kpis, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
