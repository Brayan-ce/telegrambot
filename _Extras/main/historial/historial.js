'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './historial.module.css';
import * as XLSX from 'xlsx';

export default function Historial() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ estado: '', tipo: '', desde: '', hasta: '' });
  const [page, setPage] = useState(1);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    fetch(`/api/historial?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filtros, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const [exportando, setExportando] = useState(false);

  const handleExport = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      if (filtros.estado) params.set('estado', filtros.estado);
      if (filtros.tipo) params.set('tipo', filtros.tipo);
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      const res = await fetch(`/api/historial/export?${params}`);
      const json = await res.json();
      const rows = json.rows || [];

      const wb = XLSX.utils.book_new();

      const headerRow = ['Fecha', 'Hora', 'Usuario', 'Archivo', 'Tipo', 'Tamaño (MB)', 'Estado', 'Créditos', 'URL'];
      const wsData = [headerRow, ...rows.map(r => [
        r.Fecha, r.Hora, r.Usuario, r.Archivo, r.Tipo, r.TamanioMB, r.Estado, r.Creditos, r.URL
      ])];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [10, 10, 18, 35, 12, 12, 10, 10, 40].map(w => ({ wch: w }));

      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '5A7A6A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'thin', color: { rgb: 'FFFFFF' } } },
      };
      headerRow.forEach((_, i) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: i });
        if (ws[cell]) ws[cell].s = headerStyle;
      });

      rows.forEach((r, ri) => {
        const rowStyle = { fill: { fgColor: { rgb: ri % 2 === 0 ? 'F0F4F2' : 'FFFFFF' } } };
        const estadoStyle = {
          ...rowStyle,
          font: { bold: true, color: { rgb: r.Estado === 'exitoso' ? '276749' : 'C53030' } },
        };
        headerRow.forEach((_, ci) => {
          const cell = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (ws[cell]) ws[cell].s = ci === 6 ? estadoStyle : rowStyle;
        });
      });

      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      XLSX.utils.book_append_sheet(wb, ws, 'Historial');

      const resumen = [
        ['Resumen del Reporte'],
        ['Generado', new Date().toLocaleString('es-PE')],
        ['Total registros', rows.length],
        ['Exitosas', rows.filter(r => r.Estado === 'exitoso').length],
        ['Fallidas', rows.filter(r => r.Estado === 'fallido').length],
        ['Créditos consumidos', rows.reduce((a, r) => a + Number(r.Creditos), 0)],
      ];
      const wsRes = XLSX.utils.aoa_to_sheet(resumen);
      wsRes['!cols'] = [{ wch: 22 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `historial_${fecha}.xlsx`);
    } catch (e) {
      alert('Error al exportar: ' + e.message);
    }
    setExportando(false);
  };

  const kpis = data?.kpis || {};
  const descargas = data?.descargas || [];
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <ion-icon name="time-outline" />
          <span>HISTORIAL DE ACTIVIDAD</span>
        </div>
        <button className={styles.btnExport} onClick={handleExport} disabled={exportando}>
          <ion-icon name={exportando ? 'hourglass-outline' : 'download-outline'} />
          {exportando ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="cloud-download" />
          </div>
          <div className={styles.kpiLabel}>Descargas Hoy</div>
          <div className={styles.kpiValue}>{kpis.descargas_hoy ?? 0}</div>
          <div className={styles.kpiTrend}>
            <ion-icon name="trending-up-outline" /> +234 vs ayer
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="checkmark-circle" />
          </div>
          <div className={styles.kpiLabel}>Exitosas</div>
          <div className={styles.kpiValue}>{kpis.exitosas ?? 0}</div>
          <div className={styles.kpiTrend} style={{ color: '#48bb78' }}>
            <ion-icon name="trending-up-outline" /> 93.3%
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="close-circle" />
          </div>
          <div className={styles.kpiLabel}>Fallidas</div>
          <div className={styles.kpiValue}>{kpis.fallidas ?? 0}</div>
          <div className={styles.kpiTrend} style={{ color: '#e53e3e' }}>
            <ion-icon name="trending-down-outline" /> 6.7%
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="server" />
          </div>
          <div className={styles.kpiLabel}>Datos Transferidos</div>
          <div className={styles.kpiValue}>{kpis.datos_gb ? (kpis.datos_gb / 1024).toFixed(1) + ' GB' : '0 GB'}</div>
          <div className={styles.kpiTrend}>
            <ion-icon name="trending-up-outline" /> +12% vs ayer
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.filtersBar}>
        <div className={styles.filterGroup}>
          <div className={styles.dateRange}>
            <input type="date" value={filtros.desde} onChange={(e) => { setFiltros({...filtros, desde: e.target.value}); setPage(1); }} />
            <span>hasta</span>
            <input type="date" value={filtros.hasta} onChange={(e) => { setFiltros({...filtros, hasta: e.target.value}); setPage(1); }} />
          </div>
        </div>
        <div className={styles.filterGroup}>
          <select className={styles.select} value={filtros.estado} onChange={(e) => { setFiltros({...filtros, estado: e.target.value}); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="exitoso">Exitoso</option>
            <option value="fallido">Fallido</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select className={styles.select} value={filtros.tipo} onChange={(e) => { setFiltros({...filtros, tipo: e.target.value}); setPage(1); }}>
            <option value="">Todos los tipos</option>
            <option value="Vector">Vector</option>
            <option value="PSD">PSD</option>
            <option value="Stock Photo">Stock Photo</option>
          </select>
        </div>
      </div>

      {/* Timeline / Tabla */}
      <div className={styles.timelineCard}>
        <div className={styles.cardHeader}>
          <span>Registros de descargas</span>
          <select className={styles.selectSmall}>
            <option>Mostrar 20</option>
            <option>50</option>
            <option>100</option>
          </select>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Archivo</th>
                <th>Tipo</th>
                <th>Tamaño</th>
                <th>Estado</th>
                <th>Créditos</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Cargando...</td></tr>
              ) : descargas.length === 0 ? (
                <tr><td colSpan="8" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Sin resultados</td></tr>
              ) : descargas.map((item) => (
                <tr key={item.id}>
                  <td>{item.fecha}</td>
                  <td>{item.hora}</td>
                  <td><span className={styles.username}>{item.usuario}</span></td>
                  <td className={styles.filename}>{item.archivo}</td>
                  <td><span className={styles.tipoBadge}>{item.tipo}</span></td>
                  <td>{item.tamano}</td>
                  <td>
                    <span className={`${styles.estado} ${styles[item.estado]}`}>
                      <ion-icon name={item.estado === 'exitoso' ? 'checkmark-circle' : 'close-circle'} />
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ color: '#f56565' }}>{item.creditos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className={styles.pagination}>
          <button className={styles.btnPage} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ion-icon name="chevron-back-outline" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${styles.btnPage} ${p === page ? styles.active : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className={styles.btnPage} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <ion-icon name="chevron-forward-outline" />
          </button>
        </div>
      </div>
    </div>
  );
}
