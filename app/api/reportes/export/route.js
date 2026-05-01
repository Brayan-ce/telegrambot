import { NextResponse } from 'next/server';
import pool from '../../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'Descargas';

    let rows = [];
    let sheetName = tipo;

    if (tipo === 'Descargas') {
      const [r] = await pool.query(`
        SELECT
          DATE_FORMAT(d.fecha, '%d/%m/%Y') AS Fecha,
          DATE_FORMAT(d.fecha, '%H:%i') AS Hora,
          CONCAT('@', IFNULL(u.username, u.first_name)) AS Usuario,
          d.nombre_archivo AS Archivo,
          IFNULL(d.tipo_archivo, '-') AS Tipo,
          IFNULL(d.tamano_mb, 0) AS 'Tamano MB',
          d.estado AS Estado,
          IFNULL(d.creditos_usados, 0) AS Creditos
        FROM descargas d
        JOIN usuarios u ON d.usuario_id = u.id
        ORDER BY d.fecha DESC LIMIT 5000
      `);
      rows = r;
    } else if (tipo === 'Usuarios') {
      const [r] = await pool.query(`
        SELECT
          u.id AS ID,
          u.first_name AS Nombre,
          IFNULL(u.last_name, '') AS Apellido,
          CONCAT('@', IFNULL(u.username, 'sin_username')) AS Username,
          u.telegram_id AS 'TG ID',
          u.creditos AS Creditos,
          u.estado AS Estado,
          DATE_FORMAT(u.creado_en, '%d/%m/%Y') AS Registrado,
          DATE_FORMAT(u.ultima_actividad, '%d/%m/%Y %H:%i') AS 'Ultima Actividad',
          (SELECT COUNT(*) FROM descargas d WHERE d.usuario_id = u.id AND d.estado = 'exitoso') AS Descargas
        FROM usuarios u ORDER BY u.creado_en DESC
      `);
      rows = r;
    } else if (tipo === 'Créditos') {
      const [r] = await pool.query(`
        SELECT
          DATE_FORMAT(r.fecha, '%d/%m/%Y') AS Fecha,
          CONCAT('@', IFNULL(u.username, u.first_name)) AS Usuario,
          r.cantidad AS Cantidad,
          r.descripcion AS Descripcion
        FROM recargas r
        JOIN usuarios u ON r.usuario_id = u.id
        ORDER BY r.fecha DESC LIMIT 5000
      `);
      rows = r;
    } else if (tipo === 'Errores') {
      const [r] = await pool.query(`
        SELECT
          DATE_FORMAT(d.fecha, '%d/%m/%Y %H:%i') AS Fecha,
          CONCAT('@', IFNULL(u.username, u.first_name)) AS Usuario,
          d.nombre_archivo AS Archivo,
          d.estado AS Estado,
          IFNULL(d.error_msg, 'Sin detalle') AS Error
        FROM descargas d
        JOIN usuarios u ON d.usuario_id = u.id
        WHERE d.estado = 'fallido'
        ORDER BY d.fecha DESC LIMIT 5000
      `);
      rows = r;
    } else if (tipo === 'Rendimiento') {
      const [r] = await pool.query(`
        SELECT
          DATE_FORMAT(d.fecha, '%Y-%m-%d') AS Dia,
          COUNT(*) AS Total_Descargas,
          SUM(d.estado = 'exitoso') AS Exitosas,
          SUM(d.estado = 'fallido') AS Fallidas,
          ROUND(SUM(d.estado = 'exitoso') / COUNT(*) * 100, 1) AS 'Tasa Exito %',
          COALESCE(SUM(d.creditos_usados), 0) AS Creditos_Usados
        FROM descargas d
        GROUP BY DATE(d.fecha)
        ORDER BY d.fecha DESC LIMIT 365
      `);
      rows = r;
    } else if (tipo === 'Financiero') {
      const [r] = await pool.query(`
        SELECT
          DATE_FORMAT(r.fecha, '%Y-%m') AS Mes,
          COUNT(*) AS Recargas,
          SUM(r.cantidad) AS 'Total Creditos',
          COUNT(DISTINCT r.usuario_id) AS Usuarios
        FROM recargas r
        GROUP BY DATE_FORMAT(r.fecha, '%Y-%m')
        ORDER BY r.fecha DESC
      `);
      rows = r;
    }

    return NextResponse.json({ rows, tipo: sheetName });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
