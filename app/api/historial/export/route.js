import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || '';
    const tipo = searchParams.get('tipo') || '';
    const desde = searchParams.get('desde') || '';
    const hasta = searchParams.get('hasta') || '';

    let where = [];
    let params = [];
    if (estado) { where.push('d.estado = ?'); params.push(estado); }
    if (tipo) { where.push('d.tipo_archivo = ?'); params.push(tipo); }
    if (desde) { where.push('DATE(d.fecha) >= ?'); params.push(desde); }
    if (hasta) { where.push('DATE(d.fecha) <= ?'); params.push(hasta); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(d.fecha, '%d/%m/%Y') AS Fecha,
        DATE_FORMAT(d.fecha, '%H:%i:%s') AS Hora,
        CONCAT('@', IFNULL(u.username, u.first_name)) AS Usuario,
        d.nombre_archivo AS Archivo,
        IFNULL(d.tipo_archivo, '-') AS Tipo,
        IFNULL(d.tamano_mb, 0) AS TamanioMB,
        d.estado AS Estado,
        IFNULL(d.creditos_usados, 0) AS Creditos,
        IFNULL(d.url_origen, '') AS URL
      FROM descargas d
      JOIN usuarios u ON d.usuario_id = u.id
      ${whereClause}
      ORDER BY d.fecha DESC
      LIMIT 10000
    `, params);

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
