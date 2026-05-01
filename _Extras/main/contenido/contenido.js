'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './contenido.module.css';

const TIPO_ICON = { Vector: 'shapes-outline', PSD: 'layers-outline', 'Stock Photo': 'image-outline' };

export default function Contenido() {
  const [data, setData] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [añadiendoId, setAñadiendoId] = useState(null);
  const [cantMap, setCantMap] = useState({});

  const cargar = () => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/configuracion/perfil').then(r => r.json()),
    ]).then(([dash, perfil]) => {
      setData(dash);
      setAdmin(perfil.admin || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const handleAñadir = async (usuarioId) => {
    const cant = parseInt(cantMap[usuarioId] || '0');
    if (!cant || cant === 0) return;
    setAñadiendoId(usuarioId);
    await fetch(`/api/usuarios/${usuarioId}/creditos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: cant }),
    });
    setCantMap(m => ({ ...m, [usuarioId]: '' }));
    setAñadiendoId(null);
    cargar();
  };

  const usuariosCreditos = (data?.usuarios || []).filter(u =>
    !busqueda || u.usuario?.toLowerCase().includes(busqueda.toLowerCase())
  );
  const descargasRecientes = data?.descargasRecientes || [];
  const kpis = data?.kpis || {};
  const ranking = data?.ranking || [];
  const maxRank = ranking[0]?.value || 1;

  if (loading) return <div className={styles.loading}><ion-icon name="hourglass-outline" suppressHydrationWarning /> Cargando...</div>;

  return (
    <div className={styles.dashboard}>
      {/* COLUMNA IZQUIERDA */}
      <div className={styles.leftColumn}>
        {/* Perfil del Admin */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <ion-icon name="person-outline" suppressHydrationWarning />
            <span>PERFIL DEL ADMIN</span>
          </div>
          <div className={styles.perfil}>
            <div className={styles.avatar}>
              {admin?.avatar_url
                ? <img src={admin.avatar_url} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                : <ion-icon name="person-circle" suppressHydrationWarning />
              }
            </div>
            <div className={styles.perfilInfo}>
              <div className={styles.perfilNombre}>{admin?.nombre ?? '...'}</div>
              <div className={styles.perfilId}>{admin?.email ?? ''}</div>
              <Link href="/configuracion" className={styles.perfilAdmin}>CONFIGURACIÓN</Link>
            </div>
          </div>
        </div>

        {/* Créditos por usuario */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <ion-icon name="card-outline" suppressHydrationWarning />
            <span>CRÉDITOS POR USUARIO</span>
          </div>
          <div className={styles.searchBox}>
            <ion-icon name="search-outline" suppressHydrationWarning />
            <input type="text" placeholder="Buscar usuario..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Créditos</th>
                <th>Último uso</th>
                <th>Añadir</th>
              </tr>
            </thead>
            <tbody>
              {usuariosCreditos.length === 0 ? (
                <tr><td colSpan="4" style={{textAlign:'center',padding:'1rem',color:'#a0aec0'}}>Sin usuarios</td></tr>
              ) : usuariosCreditos.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/usuarios/ver/${u.id}`} className={styles.userLink}>
                      {u.usuario}
                    </Link>
                  </td>
                  <td><strong>{u.creditos}</strong></td>
                  <td className={styles.small}>{u.ultima_actividad ? new Date(u.ultima_actividad).toLocaleDateString('es-PE') : '-'}</td>
                  <td>
                    <div className={styles.addCreditos}>
                      <input
                        type="number"
                        placeholder="0"
                        value={cantMap[u.id] || ''}
                        onChange={e => setCantMap(m => ({ ...m, [u.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleAñadir(u.id)}
                      />
                      <button
                        className={styles.btnSmall}
                        onClick={() => handleAñadir(u.id)}
                        disabled={añadiendoId === u.id}
                      >
                        <ion-icon name={añadiendoId === u.id ? 'hourglass-outline' : 'add-circle-outline'} suppressHydrationWarning />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLUMNA CENTRO */}
      <div className={styles.centerColumn}>
        <div className={styles.sectionTitle}>
          <ion-icon name="stats-chart-outline" suppressHydrationWarning />
          <span>RESUMEN DEL SISTEMA</span>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}><ion-icon name="cloud-download-outline" suppressHydrationWarning /></div>
            <div className={styles.kpiLabel}>Descargas Hoy</div>
            <div className={styles.kpiValue}>{kpis.descargas_hoy ?? 0}</div>
            <div className={styles.kpiSub}>Total hoy</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}><ion-icon name="people-outline" suppressHydrationWarning /></div>
            <div className={styles.kpiLabel}>Usuarios Activos</div>
            <div className={styles.kpiValue}>{kpis.usuarios_activos ?? 0}</div>
            <div className={styles.kpiSub}>Estado activo</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}><ion-icon name="cash-outline" suppressHydrationWarning /></div>
            <div className={styles.kpiLabel}>Créditos Hoy</div>
            <div className={styles.kpiValue}>{kpis.creditos_consumidos_hoy ?? 0}</div>
            <div className={styles.kpiSub}>Disponibles: {kpis.creditos_disponibles ?? 0}</div>
          </div>
        </div>

        <div className={styles.bottomSection}>
          {/* Estadísticas rápidas */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <ion-icon name="stats-chart-outline" suppressHydrationWarning />
              <span>Estadísticas Generales</span>
            </div>
            <div className={styles.statsList}>
              <div className={styles.statsItem}>
                <ion-icon name="cloud-download-outline" suppressHydrationWarning />
                <span>Total descargas</span>
                <strong>{kpis.total_descargas ?? 0}</strong>
              </div>
              <div className={styles.statsItem}>
                <ion-icon name="checkmark-circle-outline" suppressHydrationWarning />
                <span>Exitosas</span>
                <strong style={{color:'#38a169'}}>{kpis.total_exitosas ?? 0}</strong>
              </div>
              <div className={styles.statsItem}>
                <ion-icon name="close-circle-outline" suppressHydrationWarning />
                <span>Fallidas</span>
                <strong style={{color:'#e53e3e'}}>{kpis.total_fallidas ?? 0}</strong>
              </div>
              <div className={styles.statsItem}>
                <ion-icon name="people-outline" suppressHydrationWarning />
                <span>Total usuarios</span>
                <strong>{kpis.total_usuarios ?? 0}</strong>
              </div>
              <div className={styles.statsItem}>
                <ion-icon name="ticket-outline" suppressHydrationWarning />
                <span>Tickets abiertos</span>
                <strong>{kpis.tickets_abiertos ?? 0}</strong>
              </div>
              <div className={styles.statsItem}>
                <ion-icon name="card-outline" suppressHydrationWarning />
                <span>Créditos en BD</span>
                <strong>{kpis.creditos_disponibles ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Ranking */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <ion-icon name="trophy-outline" suppressHydrationWarning />
              <span>Top Usuarios</span>
            </div>
            {ranking.length === 0 ? (
              <p style={{textAlign:'center',padding:'1.5rem',color:'#a0aec0',fontSize:'0.85rem'}}>Sin datos aún</p>
            ) : (
              <div className={styles.rankingList}>
                {ranking.map((user, i) => (
                  <div key={i} className={styles.rankingItem}>
                    <span className={styles.rankPos}>{i + 1}</span>
                    <div className={styles.rankInfo}>
                      <div className={styles.rankTop}>
                        <span className={styles.rankName}>{user.name}</span>
                        <span className={styles.rankValue}>{user.value}</span>
                      </div>
                      <div className={styles.rankBar}>
                        <div className={styles.rankFill} style={{ width: `${(user.value / maxRank) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA */}
      <div className={styles.rightColumn}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <ion-icon name="download-outline" suppressHydrationWarning />
            <span>DESCARGAS RECIENTES</span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Archivo</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Créditos</th>
              </tr>
            </thead>
            <tbody>
              {descargasRecientes.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center',padding:'1.5rem',color:'#a0aec0'}}>Sin descargas recientes</td></tr>
              ) : descargasRecientes.map((d, i) => (
                <tr key={i}>
                  <td className={styles.small}>{d.tiempo}</td>
                  <td>{d.usuario}</td>
                  <td className={styles.filename}>{d.archivo}</td>
                  <td><ion-icon name={TIPO_ICON[d.tipo] || 'document-outline'} suppressHydrationWarning /></td>
                  <td>
                    <span className={`${styles.estadoBadge} ${styles[d.estado]}`}>
                      <ion-icon name={d.estado === 'exitoso' ? 'checkmark-circle' : d.estado === 'fallido' ? 'close-circle' : 'time'} suppressHydrationWarning />
                    </span>
                  </td>
                  <td style={{color:'#e53e3e',fontWeight:600}}>{d.creditos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.tableFooter}>
            <Link href="/historial" className={styles.verTodo}>
              Ver historial completo
              <ion-icon name="arrow-forward-outline" suppressHydrationWarning />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
