import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function PUT(request) {
  try {
    const { nuevaPassword } = await request.json();

    if (!nuevaPassword || nuevaPassword.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener mínimo 8 caracteres' }, { status: 400 });
    }

    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(nuevaPassword, 10);

    await pool.query('UPDATE admins SET password_hash = ? WHERE id = 1', [hash]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
