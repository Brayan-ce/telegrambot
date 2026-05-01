import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { estado } = await request.json();
    await pool.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
