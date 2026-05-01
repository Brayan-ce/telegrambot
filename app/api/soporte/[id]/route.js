import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const [[ticket]] = await pool.query(`
      SELECT t.id,
        CONCAT('#TK-', LPAD(t.id, 3, '0')) AS codigo,
        t.asunto, t.descripcion, t.categoria, t.prioridad,
        t.estado, t.respuestas, t.nota_admin,
        t.creado_en, t.actualizado_en,
        u.id AS usuario_id,
        CONCAT(u.first_name, IFNULL(CONCAT(' ', u.last_name), '')) AS usuario_nombre,
        CONCAT('@', IFNULL(u.username, u.first_name)) AS usuario_username,
        u.telegram_id
      FROM tickets t JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ?`, [id]);
    if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fields = [];
    const vals = [];
    if (body.estado !== undefined)    { fields.push('estado = ?');     vals.push(body.estado); }
    if (body.prioridad !== undefined)  { fields.push('prioridad = ?');  vals.push(body.prioridad); }
    if (body.categoria !== undefined)  { fields.push('categoria = ?');  vals.push(body.categoria); }
    if (body.asunto !== undefined)     { fields.push('asunto = ?');     vals.push(body.asunto); }
    if (body.nota_admin !== undefined) { fields.push('nota_admin = ?'); vals.push(body.nota_admin); }
    if (fields.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    fields.push('actualizado_en = NOW()');
    vals.push(id);
    await pool.query(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, vals);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
