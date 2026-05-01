'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../soporte.module.css';

export default function CrearTicket() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ usuario_id: '', asunto: '', categoria: 'Descargas', prioridad: 'media' });
  const [estado, setEstado] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/usuarios?limit=100')
      .then(r => r.json())
      .then(d => setUsuarios(d.usuarios || []));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.usuario_id || !form.asunto) { setError('Usuario y asunto son obligatorios'); return; }
    setEstado('guardando'); setError('');
    const res = await fetch('/api/soporte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: parseInt(form.usuario_id), asunto: form.asunto, categoria: form.categoria, prioridad: form.prioridad }),
    });
    if (res.ok) { setEstado('creado'); setTimeout(() => router.push('/soporte'), 1200); }
    else { const d = await res.json(); setError(d.error || 'Error'); setEstado('idle'); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <Link href="/soporte" className={styles.breadcrumbLink}>
            <ion-icon name="arrow-back-outline" suppressHydrationWarning />
            <span>Volver a Soporte</span>
          </Link>
        </div>
      </div>

      <div className={styles.formWrapper}>
        <div className={styles.formHeader}>
          <div className={styles.formHeaderIcon}><ion-icon name="create-outline" suppressHydrationWarning /></div>
          <div>
            <h1 className={styles.formTitle}>Nuevo Ticket</h1>
            <p className={styles.formSubtitle}>Registra un nuevo ticket de soporte</p>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <ion-icon name="warning-outline" suppressHydrationWarning />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>
              <ion-icon name="person-outline" suppressHydrationWarning />Usuario
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{gridColumn:'1/-1'}}>
                <label>Usuario <span className={styles.required}>*</span></label>
                <select name="usuario_id" value={form.usuario_id} onChange={handleChange} required>
                  <option value="">Seleccionar usuario...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.username}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div className={styles.sectionLabel}>
              <ion-icon name="document-text-outline" suppressHydrationWarning />Detalles del Ticket
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{gridColumn:'1/-1'}}>
                <label>Asunto <span className={styles.required}>*</span></label>
                <input type="text" name="asunto" value={form.asunto} onChange={handleChange} placeholder="Describe brevemente el problema" required />
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
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href="/soporte" className={styles.btnOutline}>Cancelar</Link>
            <button type="submit" className={`${styles.btnPrimary} ${estado === 'creado' ? styles.success : ''}`} disabled={estado === 'guardando'}>
              <ion-icon name={estado === 'creado' ? 'checkmark-circle' : estado === 'guardando' ? 'hourglass-outline' : 'add-circle-outline'} suppressHydrationWarning />
              {estado === 'creado' ? 'Ticket Creado!' : estado === 'guardando' ? 'Creando...' : 'Crear Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
