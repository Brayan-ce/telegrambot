'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './styles.module.css';

const tabs = [
  { href: '/configuracion', icon: 'person-outline', label: 'Perfil', exact: true },
  { href: '/configuracion/seguridad', icon: 'shield-checkmark-outline', label: 'Seguridad' },
  { href: '/configuracion/sistema', icon: 'server-outline', label: 'Sistema' },
];

export default function ConfiguracionLayout({ children }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState({ nombre: '...', email: '' });

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d) => { if (d.admin) setAdmin(d.admin); });
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <ion-icon name="settings-outline" suppressHydrationWarning />
          <span>CONFIGURACIÓN</span>
        </div>
      </div>

      {/* Layout 2 columnas */}
      <div className={styles.layout}>
        {/* Sidebar de tabs */}
        <div className={styles.sidebar}>
          <div className={styles.userPreview}>
            <div className={styles.avatarLarge}>
              {admin.avatar_url
                ? <img src={admin.avatar_url} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                : <ion-icon name="person-circle" suppressHydrationWarning />
              }
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{admin.nombre}</span>
              <span className={styles.userRole}>{admin.email}</span>
            </div>
          </div>

          <nav className={styles.navTabs}>
            {tabs.map((tab) => {
              const isActive = tab.exact 
                ? pathname === tab.href 
                : pathname === tab.href || pathname.startsWith(tab.href + '/');
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={true}
                  className={`${styles.tab} ${isActive ? styles.active : ''}`}
                >
                  <ion-icon name={tab.icon} suppressHydrationWarning />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Contenido */}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
