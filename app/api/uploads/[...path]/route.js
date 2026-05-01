import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { path: segments } = await params;
    const filePath = path.join(process.cwd(), 'uploads', ...segments);
    const buffer = await readFile(filePath);

    const ext = segments[segments.length - 1].split('.').pop().toLowerCase();
    const mime = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', gif: 'image/gif',
      webp: 'image/webp',
    }[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
}
