import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET() {
  try {
    const [[admin]] = await pool.query(`
      SELECT id, nombre, email, avatar_url, creado_en FROM admins LIMIT 1
    `);
    return NextResponse.json({ admin });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { nombre, email } = await request.json();
    const fields = [];
    const vals = [];
    if (nombre !== undefined) { fields.push('nombre = ?'); vals.push(nombre); }
    if (email !== undefined) { fields.push('email = ?'); vals.push(email); }
    if (fields.length === 0) return NextResponse.json({ ok: true });
    await pool.query(`UPDATE admins SET ${fields.join(', ')} WHERE id = 1`, vals);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
