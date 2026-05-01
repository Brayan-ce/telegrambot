import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    if (estado) { where.push('t.estado = ?'); params.push(estado); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [tickets] = await pool.query(`
      SELECT
        t.id,
        CONCAT('#TK-', LPAD(t.id, 3, '0')) AS codigo,
        CONCAT('@', IFNULL(u.username, u.first_name)) AS usuario,
        t.asunto,
        t.categoria,
        t.prioridad,
        t.estado,
        DATE_FORMAT(t.creado_en, '%Y-%m-%d') AS fecha,
        t.respuestas
      FROM tickets t
      JOIN usuarios u ON t.usuario_id = u.id
      ${whereClause}
      ORDER BY t.creado_en DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets t ${whereClause}`, params
    );

    const [[kpis]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(estado = 'abierto') AS abiertos,
        SUM(estado = 'proceso') AS en_proceso,
        SUM(estado = 'resuelto' AND DATE(actualizado_en) = CURDATE()) AS resueltos_hoy
      FROM tickets
    `);

    return NextResponse.json({ tickets, kpis, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { usuario_id, asunto, categoria, prioridad } = await request.json();
    const [result] = await pool.query(
      'INSERT INTO tickets (usuario_id, asunto, categoria, prioridad) VALUES (?, ?, ?, ?)',
      [usuario_id, asunto, categoria || 'Otro', prioridad || 'media']
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
