'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../soporte.module.css';

export default function EditarTicket({ id }) {
  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState({ asunto: '', categoria: '', prioridad: '', estado: '' });
  const [estado, setEstado] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/soporte/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.ticket) {
          setTicket(d.ticket);
          setForm({ asunto: d.ticket.asunto || '', categoria: d.ticket.categoria || '', prioridad: d.ticket.prioridad || 'media', estado: d.ticket.estado || 'abierto' });
          setEstado('idle');
        } else { setError('Ticket no encontrado'); setEstado('error'); }
      })
      .catch(() => { setError('Error al cargar'); setEstado('error'); });
  }, [id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEstado('guardando');
    const res = await fetch(`/api/soporte/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setEstado('guardado'); setTimeout(() => setEstado('idle'), 2000); }
    else { const d = await res.json(); setError(d.error || 'Error'); setEstado('idle'); }
  };

  if (estado === 'loading') return <div className={styles.verLoading}><ion-icon name="hourglass-outline" suppressHydrationWarning />Cargando...</div>;
  if (estado === 'error') return <div className={styles.verError}><ion-icon name="warning-outline" suppressHydrationWarning />{error}</div>;

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
          <Link href={`/soporte/ver/${id}`} className={styles.btnOutline}>
            <ion-icon name="eye-outline" suppressHydrationWarning />Ver
          </Link>
        </div>
      </div>

      <div className={styles.formWrapper}>
        <div className={styles.formHeader}>
          <div className={styles.formHeaderIcon}><ion-icon name="create" suppressHydrationWarning /></div>
          <div>
            <h1 className={styles.formTitle}>{ticket?.codigo} — Editar</h1>
            <p className={styles.formSubtitle}>Modifica el ticket de soporte</p>
          </div>
        </div>

        {error && <div className={styles.errorBanner}><ion-icon name="warning-outline" suppressHydrationWarning />{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>
              <ion-icon name="information-circle-outline" suppressHydrationWarning />Info del Usuario
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Usuario</label>
                <input type="text" value={`${ticket?.usuario_nombre} ${ticket?.usuario_username}`} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
              </div>
              <div className={styles.formGroup}>
                <label>TG ID</label>
                <input type="text" value={ticket?.telegram_id || ''} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>
              <ion-icon name="document-text-outline" suppressHydrationWarning />Detalles
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{gridColumn:'1/-1'}}>
                <label>Asunto</label>
                <input type="text" name="asunto" value={form.asunto} onChange={handleChange} />
              </div>
              <div className={styles.formGroup}>
                <label>Categoría</label>
                <select name="categoria" value={form.categoria} onChange={handleChange}>
                  <option value="Descargas">Descargas</option>
                  <option value="Créditos">Créditos</option>
                  <option value="Cuenta">Cuenta</option>
                  <option value="Facturación">Facturación</option>
                  <option value="API">API</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Prioridad</label>
                <select name="prioridad" value={form.prioridad} onChange={handleChange}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option value="abierto">Abierto</option>
                  <option value="proceso">En Proceso</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href={`/soporte/ver/${id}`} className={styles.btnOutline}>Cancelar</Link>
            <button type="submit" className={`${styles.btnPrimary} ${estado === 'guardado' ? styles.success : ''}`} disabled={estado === 'guardando'}>
              <ion-icon name={estado === 'guardado' ? 'checkmark' : estado === 'guardando' ? 'hourglass-outline' : 'save-outline'} suppressHydrationWarning />
              {estado === 'guardado' ? 'Guardado!' : estado === 'guardando' ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
