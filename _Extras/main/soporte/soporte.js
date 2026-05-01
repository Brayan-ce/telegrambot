'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './soporte.module.css';

const faqs = [
  { pregunta: '¿Cómo recargo mis créditos?', respuesta: 'Ve a la sección de Perfil > Créditos y selecciona el método de pago.' },
  { pregunta: '¿Qué formatos de archivo soportan?', respuesta: 'Soportamos Vector (AI, EPS, SVG), PSD, y Stock Photos (JPG, PNG).' },
  { pregunta: '¿Cuánto duran mis créditos?', respuesta: 'Los créditos no tienen fecha de vencimiento.' },
  { pregunta: '¿Puedo compartir mi cuenta?', respuesta: 'No, cada cuenta es personal e intransferible.' },
];

export default function Soporte() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(1);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (filtroEstado) params.set('estado', filtroEstado);
    fetch(`/api/soporte?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filtroEstado, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCambiarEstado = async (id, nuevoEstado) => {
    await fetch(`/api/soporte/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    cargar();
  };

  const tickets = data?.tickets || [];
  const kpis = data?.kpis || {};
  const totalPages = data ? Math.ceil(data.total / 20) : 1;
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <ion-icon name="help-circle-outline" />
          <span>CENTRO DE SOPORTE</span>
        </div>
        <Link href="/soporte/crear" className={styles.btnPrimary}>
          <ion-icon name="add-outline" />
          Nuevo Ticket
        </Link>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="ticket" />
          </div>
          <div className={styles.kpiLabel}>Tickets Totales</div>
          <div className={styles.kpiValue}>{kpis.total ?? 0}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(237, 137, 54, 0.15)' }}>
            <ion-icon name="time" style={{ color: '#dd6b20' }} />
          </div>
          <div className={styles.kpiLabel}>Abiertos</div>
          <div className={styles.kpiValue}>{kpis.abiertos ?? 0}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(66, 153, 225, 0.15)' }}>
            <ion-icon name="refresh" style={{ color: '#3182ce' }} />
          </div>
          <div className={styles.kpiLabel}>En Proceso</div>
          <div className={styles.kpiValue}>{kpis.en_proceso ?? 0}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(72, 187, 120, 0.15)' }}>
            <ion-icon name="checkmark-circle" style={{ color: '#38a169' }} />
          </div>
          <div className={styles.kpiLabel}>Resueltos Hoy</div>
          <div className={styles.kpiValue}>{kpis.resueltos_hoy ?? 0}</div>
        </div>
      </div>

      {/* Layout 2 columnas */}
      <div className={styles.twoColumn}>
        {/* Columna izquierda - Tickets */}
        <div className={styles.mainColumn}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>Tickets Recientes</span>
              <div className={styles.filterGroup}>
                <select className={styles.selectSmall} value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}>
                  <option value="">Todos</option>
                  <option value="abierto">Abiertos</option>
                  <option value="proceso">En proceso</option>
                  <option value="resuelto">Resueltos</option>
                </select>
              </div>
            </div>

            <div className={styles.ticketsList}>
              {loading ? (
                <p style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Cargando...</p>
              ) : tickets.length === 0 ? (
                <p style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Sin tickets</p>
              ) : tickets.map((ticket) => (
                <div key={ticket.id} className={styles.ticketItem}>
                  <div className={styles.ticketHeader}>
                    <div className={styles.ticketInfo}>
                      <span className={styles.ticketId}>{ticket.codigo}</span>
                      <span className={`${styles.prioridad} ${styles[ticket.prioridad]}`}>
                        {ticket.prioridad}
                      </span>
                    </div>
                    <span className={`${styles.estado} ${styles[ticket.estado]}`}>
                      {ticket.estado}
                    </span>
                  </div>
                  <h4 className={styles.ticketAsunto}>{ticket.asunto}</h4>
                  <div className={styles.ticketMeta}>
                    <span><ion-icon name="person-outline" /> {ticket.usuario}</span>
                    <span><ion-icon name="folder-outline" /> {ticket.categoria}</span>
                    <span><ion-icon name="calendar-outline" /> {ticket.fecha}</span>
                    <span><ion-icon name="chatbubble-outline" /> {ticket.respuestas} respuestas</span>
                  </div>
                  <div className={styles.ticketActions}>
                    <Link href={`/soporte/ver/${ticket.id}`} className={styles.btnSmallOutline}>
                      <ion-icon name="eye-outline" />
                      Ver
                    </Link>
                    <Link href={`/soporte/editar/${ticket.id}`} className={styles.btnSmallOutline}>
                      <ion-icon name="create-outline" />
                      Editar
                    </Link>
                    {ticket.estado !== 'resuelto' && ticket.estado !== 'cerrado' && (
                      <button className={styles.btnSmall} onClick={() => handleCambiarEstado(ticket.id, ticket.estado === 'abierto' ? 'proceso' : 'resuelto')}>
                        <ion-icon name={ticket.estado === 'abierto' ? 'play-outline' : 'checkmark-outline'} />
                        {ticket.estado === 'abierto' ? 'Tomar' : 'Resolver'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

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

        {/* Columna derecha - FAQs y Contacto */}
        <div className={styles.sideColumn}>
          {/* FAQs */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <ion-icon name="book-outline" />
              <span>PREGUNTAS FRECUENTES</span>
            </div>
            <div className={styles.faqList}>
              {faqs.map((faq, i) => (
                <div key={i} className={styles.faqItem}>
                  <div className={styles.faqQuestion}>
                    <ion-icon name="help-circle" />
                    <span>{faq.pregunta}</span>
                  </div>
                  <p className={styles.faqAnswer}>{faq.respuesta}</p>
                </div>
              ))}
            </div>
            <button className={styles.btnLink}>
              Ver todas las FAQs
              <ion-icon name="arrow-forward-outline" />
            </button>
          </div>

          {/* Contacto Directo */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <ion-icon name="mail-outline" />
              <span>CONTACTO DIRECTO</span>
            </div>
            <div className={styles.contactOptions}>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}>
                  <ion-icon name="mail" />
                </div>
                <div className={styles.contactInfo}>
                  <span className={styles.contactLabel}>Email</span>
                  <span className={styles.contactValue}>soporte@miapp.com</span>
                </div>
              </div>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}>
                  <ion-icon name="logo-whatsapp" />
                </div>
                <div className={styles.contactInfo}>
                  <span className={styles.contactLabel}>WhatsApp</span>
                  <span className={styles.contactValue}>+51 999 888 777</span>
                </div>
              </div>
              <div className={styles.contactItem}>
                <div className={styles.contactIcon}>
                  <ion-icon name="time" />
                </div>
                <div className={styles.contactInfo}>
                  <span className={styles.contactLabel}>Horario</span>
                  <span className={styles.contactValue}>Lun - Vie: 9am - 6pm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
