'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../usuarios.module.css';

export default function VerUsuario({ id }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cantCreditos, setCantCreditos] = useState('');
  const [añadiendo, setAñadiendo] = useState(false);
  const [creditoMsg, setCreditoMsg] = useState('');

  const cargar = () => {
    fetch(`/api/usuarios/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (id) cargar(); }, [id]);

  const handleAñadirCreditos = async () => {
    const cant = parseInt(cantCreditos);
    if (!cant || cant === 0) return;
    setAñadiendo(true);
    const res = await fetch(`/api/usuarios/${id}/creditos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: cant }),
    });
    if (res.ok) {
      setCantCreditos('');
      setCreditoMsg(cant > 0 ? `+${cant} créditos añadidos` : `${cant} créditos descontados`);
      cargar();
      setTimeout(() => setCreditoMsg(''), 2500);
    }
    setAñadiendo(false);
  };

  const handleEliminar = async () => {
    if (!confirm(`¿Eliminar a ${data?.usuario?.nombre}? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    router.push('/usuarios');
  };

  if (loading) return <div className={styles.verLoading}><ion-icon name="hourglass-outline" suppressHydrationWarning />Cargando...</div>;
  if (!data?.usuario) return <div className={styles.verError}><ion-icon name="warning-outline" suppressHydrationWarning />Usuario no encontrado</div>;

  const u = data.usuario;
  const actividad = data.actividad || [];
  const fechaReg = u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }) : '-';
  const fechaUso = u.ultima_actividad ? new Date(u.ultima_actividad).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Sin actividad';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <Link href="/usuarios" className={styles.breadcrumbLink}>
            <ion-icon name="arrow-back-outline" suppressHydrationWarning />
            <span>Usuarios</span>
          </Link>
        </div>
        <div className={styles.actions}>
          <Link href={`/usuarios/editar/${u.id}`} className={styles.btnOutline}>
            <ion-icon name="create-outline" suppressHydrationWarning />
            Editar
          </Link>
          <button className={styles.btnDanger} onClick={handleEliminar}>
            <ion-icon name="trash-outline" suppressHydrationWarning />
            Eliminar
          </button>
        </div>
      </div>

      <div className={styles.verLayout}>
        {/* ── Sidebar ── */}
        <div className={styles.verSidebar}>

          {/* Tarjeta de perfil */}
          <div className={styles.verProfileCard}>
            <div className={styles.verAvatarWrap}>
              <ion-icon name="person-circle" suppressHydrationWarning />
              <span className={`${styles.verEstadoDot} ${styles[u.estado]}`} />
            </div>
            <h2 className={styles.verNombre}>{u.nombre}</h2>
            <span className={styles.verUsername}>{u.username}</span>
            <span className={`${styles.estadoBadge} ${styles[u.estado]}`}>{u.estado}</span>

            <div className={styles.verMetaList}>
              <div className={styles.verMetaItem}>
                <ion-icon name="id-card-outline" suppressHydrationWarning />
                <span>TG ID: <strong>{u.telegram_id}</strong></span>
              </div>
              <div className={styles.verMetaItem}>
                <ion-icon name="calendar-outline" suppressHydrationWarning />
                <span>Registrado: <strong>{fechaReg}</strong></span>
              </div>
              <div className={styles.verMetaItem}>
                <ion-icon name="time-outline" suppressHydrationWarning />
                <span>Último uso: <strong>{fechaUso}</strong></span>
              </div>
            </div>
          </div>

          {/* Tarjeta de créditos */}
          <div className={styles.verCreditosCard}>
            <div className={styles.verCreditosTop}>
              <ion-icon name="card-outline" suppressHydrationWarning />
              <span>Créditos disponibles</span>
            </div>
            <div className={styles.verCreditosValor}>{u.creditos}</div>
            {creditoMsg && <div className={styles.verCreditoMsg}>{creditoMsg}</div>}
            <div className={styles.verCreditosInput}>
              <input
                type="number"
                placeholder="Ej: 50 o -10"
                value={cantCreditos}
                onChange={(e) => setCantCreditos(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAñadirCreditos()}
              />
              <button onClick={handleAñadirCreditos} disabled={añadiendo || !cantCreditos}>
                <ion-icon name={añadiendo ? 'hourglass-outline' : 'add-circle-outline'} suppressHydrationWarning />
                {añadiendo ? '...' : 'Aplicar'}
              </button>
            </div>
            <p className={styles.helpText}>Usa valores negativos para descontar</p>
          </div>
        </div>

        {/* ── Contenido ── */}
        <div className={styles.verContent}>
          {/* Stats */}
          <div className={styles.verStatsGrid}>
            <div className={styles.verStatCard} style={{'--c':'#8fa89a'}}>
              <ion-icon name="cloud-download-outline" suppressHydrationWarning />
              <span className={styles.verStatVal}>{u.total_descargas ?? 0}</span>
              <span className={styles.verStatLbl}>Descargas</span>
            </div>
            <div className={styles.verStatCard} style={{'--c':'#48bb78'}}>
              <ion-icon name="cash-outline" suppressHydrationWarning />
              <span className={styles.verStatVal}>{u.creditos_usados ?? 0}</span>
              <span className={styles.verStatLbl}>Créditos usados</span>
            </div>
            <div className={styles.verStatCard} style={{'--c':'#dd6b20'}}>
              <ion-icon name="chatbubble-ellipses-outline" suppressHydrationWarning />
              <span className={styles.verStatVal}>{u.total_tickets ?? 0}</span>
              <span className={styles.verStatLbl}>Tickets</span>
            </div>
            <div className={styles.verStatCard} style={{'--c':'#3182ce'}}>
              <ion-icon name="card-outline" suppressHydrationWarning />
              <span className={styles.verStatVal}>{u.creditos ?? 0}</span>
              <span className={styles.verStatLbl}>Saldo actual</span>
            </div>
          </div>

          {/* Actividad reciente */}
          <div className={styles.verActividadCard}>
            <div className={styles.verActividadHeader}>
              <ion-icon name="time-outline" suppressHydrationWarning />
              <h3>Actividad Reciente</h3>
            </div>
            {actividad.length === 0 ? (
              <div className={styles.verActividadEmpty}>
                <ion-icon name="document-outline" suppressHydrationWarning />
                <span>Sin actividad registrada aún</span>
              </div>
            ) : (
              <div className={styles.timeline}>
                {actividad.map((act, i) => (
                  <div key={i} className={styles.timelineItem}>
                    <div className={`${styles.timelineDot} ${act.tipo === 'recarga' ? styles.dotRecarga : ''}`} />
                    <div className={styles.timelineContent}>
                      <p className={styles.timelineAction}>{act.accion}</p>
                      <span className={styles.timelineDate}>
                        {act.fecha ? new Date(act.fecha).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
