'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../soporte.module.css';

const PRIORIDAD_COLOR = { baja: '#48bb78', media: '#ed8936', alta: '#e53e3e', urgente: '#742a2a' };
const ESTADO_COLOR = { abierto: '#3182ce', proceso: '#d69e2e', resuelto: '#38a169', cerrado: '#718096' };

export default function VerTicket({ id }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cambiando, setCambiando] = useState(false);

  const cargar = () => {
    fetch(`/api/soporte/${id}`)
      .then(r => r.json())
      .then(d => { setTicket(d.ticket); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (id) cargar(); }, [id]);

  const cambiarEstado = async (nuevoEstado) => {
    setCambiando(true);
    await fetch(`/api/soporte/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    cargar();
    setCambiando(false);
  };

  const eliminar = async () => {
    if (!confirm('¿Eliminar este ticket?')) return;
    await fetch(`/api/soporte/${id}`, { method: 'DELETE' });
    router.push('/soporte');
  };

  if (loading) return <div className={styles.verLoading}><ion-icon name="hourglass-outline" suppressHydrationWarning />Cargando...</div>;
  if (!ticket) return <div className={styles.verError}><ion-icon name="warning-outline" suppressHydrationWarning />Ticket no encontrado</div>;

  const fechaCreado = ticket.creado_en ? new Date(ticket.creado_en).toLocaleString('es-PE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';
  const fechaUpdate = ticket.actualizado_en ? new Date(ticket.actualizado_en).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '-';

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <Link href="/soporte" className={styles.breadcrumbLink}>
            <ion-icon name="arrow-back-outline" suppressHydrationWarning />
            <span>Soporte</span>
          </Link>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/soporte/editar/${id}`} className={styles.btnOutline}>
            <ion-icon name="create-outline" suppressHydrationWarning />Editar
          </Link>
          <button className={styles.btnDanger} onClick={eliminar}>
            <ion-icon name="trash-outline" suppressHydrationWarning />Eliminar
          </button>
        </div>
      </div>

      <div className={styles.verLayout}>
        {/* Sidebar */}
        <div className={styles.verSidebar}>
          <div className={styles.verCard}>
            <div className={styles.ticketCodigo}>{ticket.codigo}</div>
            <h2 className={styles.ticketAsunto}>{ticket.asunto}</h2>

            <div className={styles.ticketBadges}>
              <span className={styles.estadoBadge} style={{ background: `${ESTADO_COLOR[ticket.estado]}20`, color: ESTADO_COLOR[ticket.estado], border: `1px solid ${ESTADO_COLOR[ticket.estado]}40` }}>
                {ticket.estado}
              </span>
              <span className={styles.prioridadBadge} style={{ background: `${PRIORIDAD_COLOR[ticket.prioridad]}20`, color: PRIORIDAD_COLOR[ticket.prioridad] }}>
                {ticket.prioridad}
              </span>
            </div>

            <div className={styles.verMetaList}>
              <div className={styles.verMetaItem}>
                <ion-icon name="person-outline" suppressHydrationWarning />
                <span>{ticket.usuario_nombre} <strong>{ticket.usuario_username}</strong></span>
              </div>
              <div className={styles.verMetaItem}>
                <ion-icon name="pricetag-outline" suppressHydrationWarning />
                <span>Categoría: <strong>{ticket.categoria}</strong></span>
              </div>
              <div className={styles.verMetaItem}>
                <ion-icon name="calendar-outline" suppressHydrationWarning />
                <span>Creado: <strong>{fechaCreado}</strong></span>
              </div>
              <div className={styles.verMetaItem}>
                <ion-icon name="time-outline" suppressHydrationWarning />
                <span>Actualizado: <strong>{fechaUpdate}</strong></span>
              </div>
            </div>
          </div>

          {/* Cambiar estado */}
          <div className={styles.verCard}>
            <div className={styles.sectionLabel} style={{marginBottom:'0.75rem'}}>
              <ion-icon name="swap-horizontal-outline" suppressHydrationWarning />Cambiar Estado
            </div>
            <div className={styles.estadoBtns}>
              {['abierto','proceso','resuelto','cerrado'].map(e => (
                <button
                  key={e}
                  onClick={() => cambiarEstado(e)}
                  disabled={cambiando || ticket.estado === e}
                  className={styles.btnEstado}
                  style={ticket.estado === e ? { background: ESTADO_COLOR[e], color: 'white', border: `1px solid ${ESTADO_COLOR[e]}` } : {}}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className={styles.verContent}>
          <div className={styles.verCard}>
            <div className={styles.verActividadHeader}>
              <ion-icon name="document-text-outline" suppressHydrationWarning />
              <h3>Descripción</h3>
            </div>
            <p className={styles.ticketDescripcion}>
              {ticket.descripcion || <span style={{color:'#a0aec0'}}>Sin descripción proporcionada</span>}
            </p>
          </div>

          {ticket.nota_admin && (
            <div className={styles.verCard} style={{borderLeft:'3px solid #8fa89a'}}>
              <div className={styles.verActividadHeader}>
                <ion-icon name="shield-checkmark-outline" suppressHydrationWarning />
                <h3>Nota del Admin</h3>
              </div>
              <p className={styles.ticketDescripcion}>{ticket.nota_admin}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
