'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../usuarios.module.css';

export default function EditarUsuario({ id }) {
  const [estado, setEstado] = useState('loading');
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    creditos: '0',
    estado: 'activo',
  });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/usuarios/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.usuario) {
          setUsuario(d.usuario);
          setForm({
            first_name: d.usuario.first_name || '',
            last_name: d.usuario.last_name || '',
            username: d.usuario.username?.replace('@', '') || '',
            creditos: String(d.usuario.creditos),
            estado: d.usuario.estado,
          });
          setEstado('idle');
        } else {
          setError('Usuario no encontrado');
          setEstado('error');
        }
      })
      .catch(() => { setError('Error al cargar'); setEstado('error'); });
  }, [id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEstado('guardando');
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creditos: parseInt(form.creditos),
        estado: form.estado,
      }),
    });
    if (res.ok) {
      setEstado('guardado');
      setTimeout(() => setEstado('idle'), 2000);
    } else {
      const data = await res.json();
      setError(data.error || 'Error al guardar');
      setEstado('error_save');
      setTimeout(() => setEstado('idle'), 2500);
    }
  };

  if (estado === 'loading') return <div style={{padding:'2rem',color:'#718096'}}>Cargando...</div>;
  if (estado === 'error') return <div style={{padding:'2rem',color:'#e53e3e'}}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <Link href="/usuarios" className={styles.breadcrumbLink}>
            <ion-icon name="arrow-back-outline" suppressHydrationWarning />
            <span>Volver a Usuarios</span>
          </Link>
        </div>
        <div className={styles.actions}>
          <Link href={`/usuarios/ver/${id}`} className={styles.btnOutline}>
            <ion-icon name="eye-outline" suppressHydrationWarning />
            Ver Perfil
          </Link>
        </div>
      </div>

      <div className={styles.crearWrapper}>
        {/* Header */}
        <div className={styles.crearHeader}>
          <div className={styles.crearHeaderIcon}>
            <ion-icon name="create" suppressHydrationWarning />
          </div>
          <div>
            <h1 className={styles.mainTitle}>{usuario?.nombre || 'Usuario'}</h1>
            <p className={styles.subtitle}>
              ID Telegram: {usuario?.telegram_id} &bull; @{form.username || 'sin_username'}
            </p>
          </div>
        </div>

        {(estado === 'error_save') && (
          <div className={styles.errorBanner}>
            <ion-icon name="warning-outline" suppressHydrationWarning />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Info de Telegram (solo lectura) */}
          <div className={styles.crearSection}>
            <div className={styles.crearSectionLabel}>
              <ion-icon name="information-circle-outline" suppressHydrationWarning />
              Información de Telegram
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Nombre</label>
                <input type="text" value={usuario?.first_name || ''} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
              </div>
              <div className={styles.formGroup}>
                <label>Apellido</label>
                <input type="text" value={usuario?.last_name || ''} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
              </div>
              <div className={styles.formGroup}>
                <label>Username</label>
                <div className={styles.inputPrefix}>
                  <span>@</span>
                  <input type="text" value={form.username} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>ID Telegram</label>
                <input type="text" value={usuario?.telegram_id || ''} disabled style={{opacity:0.6,cursor:'not-allowed'}} />
              </div>
            </div>
            <p className={styles.helpText} style={{marginTop:'-0.25rem'}}>
              <ion-icon name="lock-closed-outline" suppressHydrationWarning /> Estos datos los actualiza el bot automáticamente
            </p>
          </div>

          {/* Configuración editable */}
          <div className={styles.crearSection}>
            <div className={styles.crearSectionLabel}>
              <ion-icon name="settings-outline" suppressHydrationWarning />
              Configuración de Cuenta
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Créditos</label>
                <div className={styles.crearInputIcon}>
                  <ion-icon name="card-outline" suppressHydrationWarning />
                  <input
                    type="number"
                    name="creditos"
                    value={form.creditos}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baneado">Baneado</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href={`/usuarios/ver/${id}`} className={styles.btnOutline}>
              Cancelar
            </Link>
            <button
              type="submit"
              className={`${styles.btnPrimary} ${estado === 'guardado' ? styles.success : ''}`}
              disabled={estado === 'guardando'}
            >
              <ion-icon
                name={estado === 'guardado' ? 'checkmark' : estado === 'guardando' ? 'hourglass-outline' : 'save-outline'}
                suppressHydrationWarning
              />
              {estado === 'guardado' ? 'Guardado!' : estado === 'guardando' ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
