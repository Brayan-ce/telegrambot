'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './control-precio.module.css';

export default function ControlPrecio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historialCompleto, setHistorialCompleto] = useState([]);

  const [form, setForm] = useState({
    costo_por_descarga_usd: '0.025',
    tipo_cambio: '3.760',
    costo_api_usd: '0.094',
    aplica_desde: '',
    estado: 'activo',
    recomendacion: '',
    motivo: '',
  });

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/control-precio');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar Control de Precio');
      setData(json);

      const aplicaDesde = json?.config?.aplica_desde
        ? new Date(json.config.aplica_desde).toISOString().slice(0, 16)
        : '';

      setForm((prev) => ({
        ...prev,
        costo_por_descarga_usd: String(json?.config?.costo_por_descarga_usd ?? '0.025'),
        tipo_cambio: String(json?.config?.tipo_cambio ?? '3.760'),
        costo_api_usd: String(json?.config?.costo_api_usd ?? '0.094'),
        aplica_desde: aplicaDesde,
        estado: json?.config?.estado || 'activo',
        recomendacion: json?.config?.recomendacion || '',
      }));
    } catch (e) {
      setError(e.message || 'Error de carga');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const costoApiPen = useMemo(() => {
    const usd = Number(form.costo_api_usd || 0);
    const tc = Number(form.tipo_cambio || 0);
    return (usd * tc).toFixed(3);
  }, [form.costo_api_usd, form.tipo_cambio]);

  const maxRanking = useMemo(() => {
    const ranking = data?.ranking || [];
    return ranking.length ? Number(ranking[0].value) : 1;
  }, [data]);

  const maxSerie = useMemo(() => {
    const series = data?.series || [];
    if (!series.length) return 1;
    let max = 1;
    series.forEach((s) => {
      max = Math.max(max, Number(s.exitosas || 0), Number(s.pendientes || 0), Number(s.fallidas || 0));
    });
    return max;
  }, [data]);

  const handleGuardar = async () => {
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const res = await fetch('/api/control-precio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costo_por_descarga_usd: Number(form.costo_por_descarga_usd),
          tipo_cambio: Number(form.tipo_cambio),
          costo_api_usd: Number(form.costo_api_usd),
          aplica_desde: form.aplica_desde ? new Date(form.aplica_desde).toISOString().slice(0, 19).replace('T', ' ') : null,
          estado: form.estado,
          recomendacion: form.recomendacion,
          motivo: form.motivo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar');
      setOkMsg('Precio guardado correctamente');
      setForm((prev) => ({ ...prev, motivo: '' }));
      await cargar();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
      setTimeout(() => setOkMsg(''), 2200);
    }
  };

  const handleVerHistorial = async () => {
    setMostrarHistorial((prev) => !prev);
    if (!mostrarHistorial) {
      const res = await fetch('/api/control-precio/historial');
      const json = await res.json();
      if (res.ok) setHistorialCompleto(json.rows || []);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <ion-icon name="hourglass-outline" suppressHydrationWarning />
        Cargando Control de Precio...
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.gridTop}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ion-icon name="swap-horizontal-outline" suppressHydrationWarning />
              Pestana 4: Registro de movimientos
            </div>
            <span className={styles.pill}>Hoy</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Ingreso (USD)</th>
                  <th>Egreso API (USD)</th>
                  <th>Egreso API (PEN)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movimientos || []).map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td>{m.usuario}</td>
                    <td>{m.accion}</td>
                    <td className={styles.okNum}>+{Number(m.ingreso_usd || 0).toFixed(3)}</td>
                    <td className={styles.warnNum}>-{Number(m.egreso_api_usd || 0).toFixed(3)}</td>
                    <td className={styles.warnNum}>-{Number(m.egreso_api_pen || 0).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {(data?.movimientos || []).map((m) => (
              <article key={`m-${m.id}`} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileTitle}>{m.usuario}</span>
                  <span className={styles.mobileDate}>{m.fecha}</span>
                </div>
                <div className={styles.mobileRow}><strong>Accion:</strong> {m.accion}</div>
                <div className={styles.mobileGrid}>
                  <div>
                    <span>Ingreso USD</span>
                    <p className={styles.okNum}>+{Number(m.ingreso_usd || 0).toFixed(3)}</p>
                  </div>
                  <div>
                    <span>Egreso API USD</span>
                    <p className={styles.warnNum}>-{Number(m.egreso_api_usd || 0).toFixed(3)}</p>
                  </div>
                  <div>
                    <span>Egreso API PEN</span>
                    <p className={styles.warnNum}>-{Number(m.egreso_api_pen || 0).toFixed(3)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.cardFooter}>Duplica reporte</div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ion-icon name="pricetag-outline" suppressHydrationWarning />
              Control de Precio
            </div>
            <span className={`${styles.status} ${form.estado === 'activo' ? styles.statusOn : styles.statusOff}`}>
              {form.estado.toUpperCase()}
            </span>
          </div>

          {!!error && <div className={styles.errorBanner}>{error}</div>}
          {!!okMsg && <div className={styles.okBanner}>{okMsg}</div>}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Costo API por descarga (USD)</span>
              <input
                type="number"
                step="0.001"
                value={form.costo_por_descarga_usd}
                onChange={(e) => setForm((p) => ({ ...p, costo_por_descarga_usd: e.target.value }))}
              />
            </label>

            <label className={styles.field}>
              <span>Tipo de cambio mensual</span>
              <input
                type="number"
                step="0.001"
                value={form.tipo_cambio}
                onChange={(e) => setForm((p) => ({ ...p, tipo_cambio: e.target.value }))}
              />
            </label>

            <label className={styles.field}>
              <span>Costo API en soles (S/)</span>
              <input value={costoApiPen} readOnly />
            </label>

            <label className={styles.field}>
              <span>Aplica desde</span>
              <input
                type="datetime-local"
                value={form.aplica_desde}
                onChange={(e) => setForm((p) => ({ ...p, aplica_desde: e.target.value }))}
              />
            </label>

            <label className={styles.field}>
              <span>Costo API en USD (S/.)</span>
              <input
                type="number"
                step="0.001"
                value={form.costo_api_usd}
                onChange={(e) => setForm((p) => ({ ...p, costo_api_usd: e.target.value }))}
              />
            </label>

            <label className={styles.field}>
              <span>Estado</span>
              <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span>Motivo del cambio</span>
            <input
              type="text"
              placeholder="Ej. Ajuste de costo proveedor"
              value={form.motivo}
              onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
            />
          </label>

          <div className={styles.reco}>
            <ion-icon name="information-circle-outline" suppressHydrationWarning />
            <p>{form.recomendacion || 'Guarda este valor y ajusta la tasa cuando cambie el proveedor.'}</p>
          </div>

          <div className={styles.cardActions}>
            <button type="button" className={styles.btnGhost} onClick={handleVerHistorial}>
              <ion-icon name="time-outline" suppressHydrationWarning />
              Ver historial
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
              <ion-icon name={saving ? 'hourglass-outline' : 'save-outline'} suppressHydrationWarning />
              {saving ? 'Guardando...' : 'Guardar precio'}
            </button>
          </div>
        </section>
      </div>

      <div className={styles.gridBottom}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ion-icon name="trophy-outline" suppressHydrationWarning />
              Ranking (Top) de Usuarios
            </div>
            <span className={styles.pill}>Ver reporte</span>
          </div>

          <div className={styles.rankingList}>
            {(data?.ranking || []).map((item, idx) => {
              const width = `${Math.max(18, (Number(item.value || 0) / maxRanking) * 100)}%`;
              return (
                <div key={`${item.name}-${idx}`} className={styles.rankRow}>
                  <div className={styles.rankName}>{item.name}</div>
                  <div className={styles.rankBarTrack}>
                    <div className={styles.rankBar} style={{ width }} />
                  </div>
                  <div className={styles.rankValue}>{item.value} descargas</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ion-icon name="bar-chart-outline" suppressHydrationWarning />
              Panel de Descargas Diarias
            </div>
            <span className={styles.pill}>Ultimos 14 dias</span>
          </div>

          <div className={styles.legend}>
            <span><i className={styles.dotOk} /> Exitosas</span>
            <span><i className={styles.dotMid} /> Pendientes</span>
            <span><i className={styles.dotBad} /> Fallidas</span>
          </div>

          <div className={styles.chart}>
            {(data?.series || []).map((s) => {
              const hOk = `${(Number(s.exitosas || 0) / maxSerie) * 100}%`;
              const hMid = `${(Number(s.pendientes || 0) / maxSerie) * 100}%`;
              const hBad = `${(Number(s.fallidas || 0) / maxSerie) * 100}%`;
              return (
                <div key={s.dia} className={styles.chartCol}>
                  <div className={styles.bars}>
                    <div className={styles.barOk} style={{ height: hOk }} />
                    <div className={styles.barMid} style={{ height: hMid }} />
                    <div className={styles.barBad} style={{ height: hBad }} />
                  </div>
                  <span>{s.dia}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {mostrarHistorial && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ion-icon name="receipt-outline" suppressHydrationWarning />
              Historial de cambios
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Admin</th>
                  <th>Costo/descarga</th>
                  <th>TC</th>
                  <th>API USD</th>
                  <th>API PEN</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historialCompleto.map((h) => (
                  <tr key={h.id}>
                    <td>{h.fecha}</td>
                    <td>{h.admin}</td>
                    <td>{Number(h.costo_por_descarga_despues || 0).toFixed(3)}</td>
                    <td>{Number(h.tipo_cambio_despues || 0).toFixed(3)}</td>
                    <td>{Number(h.costo_api_usd_despues || 0).toFixed(3)}</td>
                    <td>{Number(h.costo_api_pen_despues || 0).toFixed(3)}</td>
                    <td>{h.motivo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {historialCompleto.map((h) => (
              <article key={`h-${h.id}`} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileTitle}>{h.admin}</span>
                  <span className={styles.mobileDate}>{h.fecha}</span>
                </div>
                <div className={styles.mobileGrid}>
                  <div>
                    <span>Costo/descarga</span>
                    <p>{Number(h.costo_por_descarga_despues || 0).toFixed(3)}</p>
                  </div>
                  <div>
                    <span>TC</span>
                    <p>{Number(h.tipo_cambio_despues || 0).toFixed(3)}</p>
                  </div>
                  <div>
                    <span>API USD</span>
                    <p>{Number(h.costo_api_usd_despues || 0).toFixed(3)}</p>
                  </div>
                  <div>
                    <span>API PEN</span>
                    <p>{Number(h.costo_api_pen_despues || 0).toFixed(3)}</p>
                  </div>
                </div>
                <div className={styles.mobileRow}><strong>Motivo:</strong> {h.motivo || '-'}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
