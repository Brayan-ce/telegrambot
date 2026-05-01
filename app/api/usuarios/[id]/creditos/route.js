import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { cantidad, nota } = await request.json();

    const [[usuario]] = await pool.query('SELECT creditos FROM usuarios WHERE id = ?', [id]);
    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const antes = usuario.creditos;
    const despues = antes + parseInt(cantidad);

    await pool.query('UPDATE usuarios SET creditos = ? WHERE id = ?', [despues, id]);
    await pool.query(
      'INSERT INTO recargas (usuario_id, admin_id, creditos, creditos_antes, creditos_despues, metodo, nota) VALUES (?, 1, ?, ?, ?, ?, ?)',
      [id, cantidad, antes, despues, 'admin', nota || null]
    );

    return NextResponse.json({ ok: true, creditos: despues });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
