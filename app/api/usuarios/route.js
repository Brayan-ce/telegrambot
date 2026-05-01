import { NextResponse } from 'next/server';
import pool from '../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const buscar = searchParams.get('buscar') || '';
    const estado = searchParams.get('estado') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (buscar) {
      where.push('(u.first_name LIKE ? OR u.username LIKE ?)');
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (estado) { where.push('u.estado = ?'); params.push(estado); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [usuarios] = await pool.query(`
      SELECT
        u.id,
        u.telegram_id,
        CONCAT(u.first_name, IFNULL(CONCAT(' ', u.last_name), '')) AS nombre,
        CONCAT('@', IFNULL(u.username, 'sin_username')) AS username,
        u.creditos,
        u.estado,
        u.ultima_actividad,
        u.creado_en,
        (SELECT COUNT(*) FROM descargas d WHERE d.usuario_id = u.id) AS total_descargas
      FROM usuarios u
      ${whereClause}
      ORDER BY u.ultima_actividad DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`, params
    );

    const [[kpis]] = await pool.query(`
      SELECT
        COUNT(*) AS total_usuarios,
        SUM(estado = 'activo') AS activos,
        SUM(estado = 'inactivo') AS inactivos,
        SUM(estado = 'baneado') AS baneados
      FROM usuarios
    `);

    return NextResponse.json({ usuarios, kpis, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { telegram_id, username, first_name, last_name, chat_id, creditos, estado } = await request.json();
    const [result] = await pool.query(
      'INSERT INTO usuarios (telegram_id, username, first_name, last_name, chat_id, creditos, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [telegram_id, username, first_name, last_name, chat_id || telegram_id, creditos || 0, estado || 'activo']
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
