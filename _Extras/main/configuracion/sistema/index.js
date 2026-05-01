'use client';

import { useState, useEffect } from 'react'; // useState kept for future use
import styles from '../layout/styles.module.css';

export default function Sistema() {
  const [sysInfo, setSysInfo] = useState(null);

  useEffect(() => {
    fetch('/api/configuracion/sistema')
      .then((r) => r.json())
      .then((d) => setSysInfo(d));
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Información del Sistema</h3>
      </div>

      <div className={styles.systemInfo}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Base de datos</span>
            <span className={styles.infoValue}>MySQL {sysInfo?.dbVersion ?? '...'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Total Usuarios</span>
            <span className={styles.infoValue}>{sysInfo?.stats?.total_usuarios ?? '...'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Total Descargas</span>
            <span className={styles.infoValue}>{sysInfo?.stats?.total_descargas ?? '...'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Total Tickets</span>
            <span className={styles.infoValue}>{sysInfo?.stats?.total_tickets ?? '...'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Total Recargas</span>
            <span className={styles.infoValue}>{sysInfo?.stats?.total_recargas ?? '...'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Total Reportes</span>
            <span className={styles.infoValue}>{sysInfo?.stats?.total_reportes ?? '...'}</span>
          </div>
        </div>
      </div>

      <div className={styles.tablasList}>
        <h4 className={styles.subTitle}>Tablas en la BD</h4>
        <div className={styles.tablasGrid}>
          {['admins','usuarios','descargas','recargas','tickets','ticket_respuestas','reportes'].map(t => (
            <span key={t} className={styles.tablaTag}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
