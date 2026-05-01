'use client';

import { useState, useEffect } from 'react';
import styles from './reportes.module.css';
import * as XLSX from 'xlsx';

export default function Reportes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(null);

  const cargar = () => {
    fetch('/api/reportes')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const exportarExcel = async (tipo, reporteId) => {
    const res = await fetch(`/api/reportes/export?tipo=${encodeURIComponent(tipo)}`);
    const json = await res.json();
    const rows = json.rows || [];
    if (rows.length === 0) { alert('Sin datos para exportar'); return; }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    const headers = Object.keys(rows[0]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '5A7A6A' } },
      alignment: { horizontal: 'center' },
    };
    headers.forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cell]) ws[cell].s = headerStyle;
    });
    rows.forEach((_, ri) => {
      headers.forEach((_, ci) => {
        const cell = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (ws[cell]) ws[cell].s = { fill: { fgColor: { rgb: ri % 2 === 0 ? 'F0F4F2' : 'FFFFFF' } } };
      });
    });
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, tipo.slice(0, 31));

    const resumenData = [
      ['Reporte', tipo],
      ['Generado', new Date().toLocaleString('es-PE')],
      ['Total registros', rows.length],
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(resumenData);
    wsRes['!cols'] = [{ wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

    XLSX.writeFile(wb, `reporte_${tipo.toLowerCase().replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    if (reporteId) {
      await fetch(`/api/reportes/${reporteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'listo' }),
      });
      cargar();
    }
  };

  const handleGenerar = async (tipo, formato) => {
    setGenerando(tipo);
    const res = await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: `Reporte de ${tipo} - ${new Date().toLocaleDateString('es-PE')}`, tipo, formato }),
    });
    const data = await res.json();
    await exportarExcel(tipo, data.id);
    setGenerando(null);
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este reporte?')) return;
    await fetch('/api/reportes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    cargar();
  };

  const reportesGenerados = data?.reportes || [];
  const stats = data?.stats || {};

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <ion-icon name="document-text-outline" />
          <span>CENTRO DE REPORTES</span>
        </div>
      </div>

      {/* Grid de Reportes */}
      <div className={styles.reportsGrid}>
        {/* Reporte Descargas */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="cloud-download" />
          </div>
          <h3>Descargas</h3>
          <p>Análisis detallado de descargas por período</p>
          <div className={styles.reportOptions}>
            <span style={{fontSize:'0.8rem',color:'#718096'}}>Hoy: {stats.descargas_hoy ?? 0} | Semana: {stats.descargas_semana ?? 0}</span>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Descargas','PDF')} disabled={generando === 'Descargas'}>
              <ion-icon name="play-outline" />
              {generando === 'Descargas' ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {/* Reporte Usuarios */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="people" />
          </div>
          <h3>Usuarios</h3>
          <p>Actividad y comportamiento de usuarios</p>
          <div className={styles.reportOptions}>
            <span style={{fontSize:'0.8rem',color:'#718096'}}>Activos: {stats.usuarios_activos ?? 0}</span>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Usuarios','Excel')} disabled={generando === 'Usuarios'}>
              <ion-icon name="play-outline" />
              {generando === 'Usuarios' ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {/* Reporte Créditos */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="cash" />
          </div>
          <h3>Créditos</h3>
          <p>Consumo y distribución de créditos</p>
          <div className={styles.reportOptions}>
            <span style={{fontSize:'0.8rem',color:'#718096'}}>Mes: {stats.creditos_mes ?? 0} usados</span>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Créditos','PDF')} disabled={generando === 'Créditos'}>
              <ion-icon name="play-outline" />
              {generando === 'Créditos' ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {/* Reporte Errores */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="warning" />
          </div>
          <h3>Errores</h3>
          <p>Log de errores y fallas del sistema</p>
          <div className={styles.reportOptions}>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Errores','CSV')} disabled={generando === 'Errores'}>
              <ion-icon name="play-outline" />
              {generando === 'Errores' ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {/* Reporte Rendimiento */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="speedometer" />
          </div>
          <h3>Rendimiento</h3>
          <p>Métricas de rendimiento del sistema</p>
          <div className={styles.reportOptions}>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Rendimiento','PDF')} disabled={generando === 'Rendimiento'}>
              <ion-icon name="play-outline" />
              {generando === 'Rendimiento' ? '...' : 'Generar'}
            </button>
          </div>
        </div>

        {/* Reporte Financiero */}
        <div className={styles.reportCard}>
          <div className={styles.reportIcon}>
            <ion-icon name="bar-chart" />
          </div>
          <h3>Financiero</h3>
          <p>Ingresos y proyecciones financieras</p>
          <div className={styles.reportOptions}>
            <button className={styles.btnGenerate} onClick={() => handleGenerar('Financiero','PDF')} disabled={generando === 'Financiero'}>
              <ion-icon name="play-outline" />
              {generando === 'Financiero' ? '...' : 'Generar'}
            </button>
          </div>
        </div>
      </div>

      {/* Reportes Generados */}
      <div className={styles.generatedSection}>
        <div className={styles.sectionTitle}>
          <ion-icon name="folder-open-outline" />
          <span>REPORTES GENERADOS</span>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Formato</th>
                  <th>Estado</th>
                  <th>Tamaño</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Cargando...</td></tr>
                ) : reportesGenerados.length === 0 ? (
                  <tr><td colSpan="7" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Sin reportes generados</td></tr>
                ) : reportesGenerados.map((reporte) => (
                  <tr key={reporte.id}>
                    <td className={styles.nombreReporte}>{reporte.nombre}</td>
                    <td><span className={styles.tipoBadge}>{reporte.tipo}</span></td>
                    <td>{reporte.fecha}</td>
                    <td><span className={styles.formatoBadge}>{reporte.formato}</span></td>
                    <td>
                      <span className={`${styles.estado} ${styles[reporte.estado]}`}>
                        <ion-icon name={reporte.estado === 'listo' ? 'checkmark-circle' : 'time'} />
                        {reporte.estado}
                      </span>
                    </td>
                    <td>{reporte.tamano}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.btnIcon}
                          title="Descargar Excel"
                          onClick={() => exportarExcel(reporte.tipo, null)}
                        >
                          <ion-icon name="download-outline" />
                        </button>
                        <button className={styles.btnIconDanger} title="Eliminar" onClick={() => handleEliminar(reporte.id)}>
                          <ion-icon name="trash-outline" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
