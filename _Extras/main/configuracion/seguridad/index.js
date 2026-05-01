'use client';

import { useState } from 'react';
import styles from '../layout/styles.module.css';

export default function Seguridad() {
  const [form, setForm] = useState({ nueva: '', confirmar: '' });
  const [estado, setEstado] = useState('idle');
  const [msg, setMsg] = useState('');

  const handleGuardar = async () => {
    if (form.nueva !== form.confirmar) { setMsg('Las contraseñas no coinciden'); return; }
    if (form.nueva.length < 8) { setMsg('Mínimo 8 caracteres'); return; }
    setEstado('guardando'); setMsg('');
    const res = await fetch('/api/configuracion/seguridad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevaPassword: form.nueva }),
    });
    const data = await res.json();
    if (res.ok) { setEstado('guardado'); setForm({ nueva: '', confirmar: '' }); }
    else { setEstado('error'); setMsg(data.error || 'Error al guardar'); }
    setTimeout(() => setEstado('idle'), 2500);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Cambiar Contraseña</h3>
        <button className={styles.btnGuardar} onClick={handleGuardar} disabled={estado === 'guardando'}>
          <ion-icon name="save-outline" suppressHydrationWarning />
          {estado === 'guardando' ? 'Guardando...' : estado === 'guardado' ? 'Guardado!' : estado === 'error' ? 'Error!' : 'Guardar Cambios'}
        </button>
      </div>
      {msg && <p style={{ color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{msg}</p>}

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Nueva Contraseña</label>
          <input type="password" placeholder="Mínimo 8 caracteres" value={form.nueva} onChange={(e) => setForm({ ...form, nueva: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label>Confirmar Contraseña</label>
          <input type="password" placeholder="Repetir nueva contraseña" value={form.confirmar} onChange={(e) => setForm({ ...form, confirmar: e.target.value })} />
        </div>
      </div>

      <div className={styles.securityInfo}>
        <ion-icon name="information-circle-outline" suppressHydrationWarning />
        <span>La contraseña se guarda cifrada con bcrypt en la tabla <strong>admins</strong>.</span>
      </div>
    </div>
  );
}
