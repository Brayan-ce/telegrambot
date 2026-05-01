'use client';

import { useState, useEffect, useRef } from 'react';
import styles from '../layout/styles.module.css';

export default function Perfil() {
  const [form, setForm] = useState({ nombre: '', email: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [estado, setEstado] = useState('idle');
  const [uploadando, setUploadando] = useState(false);
  const [creadoEn, setCreadoEn] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d) => {
        if (d.admin) {
          setForm({ nombre: d.admin.nombre, email: d.admin.email });
          setAvatarUrl(d.admin.avatar_url || '');
          setCreadoEn(d.admin.creado_en ? new Date(d.admin.creado_en).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }) : '');
        }
      });
  }, []);

  const handleGuardar = async () => {
    setEstado('guardando');
    const res = await fetch('/api/configuracion/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setEstado(res.ok ? 'guardado' : 'error');
    setTimeout(() => setEstado('idle'), 2000);
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Máximo 2 MB'); return; }
    setUploadando(true);
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch('/api/configuracion/perfil/avatar', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) setAvatarUrl(data.url + '?t=' + Date.now());
    else alert('Error al subir: ' + (data.error || 'desconocido'));
    setUploadando(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleEliminarAvatar = async () => {
    await fetch('/api/configuracion/perfil/avatar', { method: 'DELETE' });
    setAvatarUrl('');
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Información del Perfil</h3>
        <button className={styles.btnGuardar} onClick={handleGuardar} disabled={estado === 'guardando'}>
          <ion-icon name="save-outline" suppressHydrationWarning />
          {estado === 'guardando' ? 'Guardando...' : estado === 'guardado' ? 'Guardado!' : estado === 'error' ? 'Error!' : 'Guardar Cambios'}
        </button>
      </div>

      <div className={styles.avatarSection}>
        <div className={styles.avatarUpload}>
          <div className={styles.avatarPreview}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
              : <ion-icon name="person-circle" suppressHydrationWarning />
            }
          </div>
          <div className={styles.avatarMeta}>
            <span className={styles.avatarNombre}>{form.nombre}</span>
            <span className={styles.avatarEmail}>{form.email}</span>
            {creadoEn && <span className={styles.avatarFecha}>Admin desde {creadoEn}</span>}
            <div className={styles.avatarActions}>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatar} />
              <button className={styles.btnSecondary} onClick={() => fileRef.current?.click()} disabled={uploadando}>
                <ion-icon name={uploadando ? 'hourglass-outline' : 'cloud-upload-outline'} suppressHydrationWarning />
                {uploadando ? 'Subiendo...' : 'Subir foto'}
              </button>
              {avatarUrl && (
                <button className={styles.btnText} onClick={handleEliminarAvatar}>
                  <ion-icon name="trash-outline" suppressHydrationWarning />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Nombre Completo</label>
          <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
