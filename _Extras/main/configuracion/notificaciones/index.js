'use client';

import { useState } from 'react';
import styles from '../layout/styles.module.css';

export default function Notificaciones() {
  const [guardado, setGuardado] = useState(false);

  const handleGuardar = () => {
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Preferencias de Notificaciones</h3>
        <button className={styles.btnGuardar} onClick={handleGuardar}>
          <ion-icon name="save-outline" suppressHydrationWarning />
          {guardado ? 'Guardado!' : 'Guardar Cambios'}
        </button>
      </div>
      
      <div className={styles.toggleItem}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Nuevos usuarios registrados</span>
          <span className={styles.toggleDesc}>Recibir alerta cuando un nuevo usuario se registre</span>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" defaultChecked />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>

      <div className={styles.toggleItem}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Descargas completadas</span>
          <span className={styles.toggleDesc}>Notificación cuando un usuario complete una descarga</span>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>

      <div className={styles.toggleItem}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Créditos bajos</span>
          <span className={styles.toggleDesc}>Alerta cuando un usuario tenga menos de 10 créditos</span>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" defaultChecked />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>

      <div className={styles.toggleItem}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Tickets de soporte</span>
          <span className={styles.toggleDesc}>Notificar nuevos tickets o respuestas</span>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" defaultChecked />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>

      <div className={styles.toggleItem}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Reportes diarios</span>
          <span className={styles.toggleDesc}>Resumen diario por email</span>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" />
          <span className={styles.toggleSwitch}></span>
        </label>
      </div>
    </div>
  );
}
