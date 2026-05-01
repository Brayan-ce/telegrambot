import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('avatar');
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filename = `admin_1_${Date.now()}.${ext}`;

    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/api/uploads/avatars/${filename}`;
    await pool.query('UPDATE admins SET avatar_url = ? WHERE id = 1', [url]);

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await pool.query('UPDATE admins SET avatar_url = NULL WHERE id = 1');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
