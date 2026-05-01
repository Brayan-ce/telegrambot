import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET() {
  try {
    const [[dbInfo]] = await pool.query('SELECT VERSION() AS version');
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM descargas) AS total_descargas,
        (SELECT COUNT(*) FROM recargas) AS total_recargas,
        (SELECT COUNT(*) FROM tickets) AS total_tickets,
        (SELECT COUNT(*) FROM reportes) AS total_reportes
    `);
    return NextResponse.json({ dbVersion: dbInfo.version, stats });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
