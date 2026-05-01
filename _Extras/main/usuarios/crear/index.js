'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../usuarios.module.css';

export default function CrearUsuario() {
  const router = useRouter();
  const [form, setForm] = useState({
    telegram_id: '',
    first_name: '',
    last_name: '',
    username: '',
    creditos: '0',
    estado: 'activo',
  });
  const [estado, setEstado] = useState('idle');
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.telegram_id || !form.first_name) {
      setError('El ID de Telegram y el nombre son obligatorios.');
      return;
    }
    setEstado('guardando'); setError('');
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: parseInt(form.telegram_id),
        first_name: form.first_name,
        last_name: form.last_name || null,
        username: form.username || null,
        creditos: parseInt(form.creditos),
        estado: form.estado,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setEstado('creado');
      setTimeout(() => router.push('/usuarios'), 1200);
    } else {
      setError(data.error || 'Error al crear usuario');
      setEstado('idle');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <Link href="/usuarios" className={styles.breadcrumbLink}>
            <ion-icon name="arrow-back-outline" suppressHydrationWarning />
            <span>Volver a Usuarios</span>
          </Link>
        </div>
      </div>

      <div className={styles.crearWrapper}>
        {/* Título */}
        <div className={styles.crearHeader}>
          <div className={styles.crearHeaderIcon}>
            <ion-icon name="person-add" suppressHydrationWarning />
          </div>
          <div>
            <h1 className={styles.mainTitle}>Nuevo Usuario</h1>
            <p className={styles.subtitle}>Registra manualmente un usuario de Telegram</p>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <ion-icon name="warning-outline" suppressHydrationWarning />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Sección Telegram */}
          <div className={styles.crearSection}>
            <div className={styles.crearSectionLabel}>
              <ion-icon name="chatbubble-ellipses-outline" suppressHydrationWarning />
              Datos de Telegram
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>ID de Telegram <span className={styles.required}>*</span></label>
                <div className={styles.crearInputIcon}>
                  <ion-icon name="id-card-outline" suppressHydrationWarning />
                  <input
                    type="number"
                    name="telegram_id"
                    value={form.telegram_id}
                    onChange={handleChange}
                    placeholder="Ej: 123456789"
                    required
                  />
                </div>
                <span className={styles.helpText}>ID numérico único de Telegram</span>
              </div>

              <div className={styles.formGroup}>
                <label>Username</label>
                <div className={styles.inputPrefix}>
                  <span>@</span>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="usuario123"
                  />
                </div>
                <span className={styles.helpText}>Sin el @ delante</span>
              </div>
            </div>
          </div>

          {/* Sección Nombre */}
          <div className={styles.crearSection}>
            <div className={styles.crearSectionLabel}>
              <ion-icon name="person" suppressHydrationWarning />
              Nombre
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Nombre <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Juan"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Apellido</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Pérez"
                />
              </div>
            </div>
          </div>

          {/* Sección Cuenta */}
          <div className={styles.crearSection}>
            <div className={styles.crearSectionLabel}>
              <ion-icon name="settings-outline" suppressHydrationWarning />
              Configuración
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Créditos Iniciales</label>
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
                </select>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className={styles.formActions}>
            <Link href="/usuarios" className={styles.btnOutline}>
              Cancelar
            </Link>
            <button
              type="submit"
              className={`${styles.btnPrimary} ${estado === 'creado' ? styles.success : ''}`}
              disabled={estado === 'guardando'}
            >
              <ion-icon
                name={estado === 'creado' ? 'checkmark-circle' : estado === 'guardando' ? 'hourglass-outline' : 'person-add-outline'}
                suppressHydrationWarning
              />
              {estado === 'creado' ? '¡Usuario Creado!' : estado === 'guardando' ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
