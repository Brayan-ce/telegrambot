'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './header.module.css';

const navItems = [
  { href: '/dashboard', icon: 'grid-outline', label: 'Dashboard' },
  { href: '/control-precio', icon: 'pricetag-outline', label: 'Control' },
  { href: '/usuarios', icon: 'people-outline', label: 'Usuarios' },
  { href: '/historial', icon: 'time-outline', label: 'Historial' },
  { href: '/reportes', icon: 'document-text-outline', label: 'Reportes' },
  { href: '/soporte', icon: 'help-circle-outline', label: 'Soporte' },
];

export default function Header({ children }) {
  const pathname = usePathname();

  return (
    <div className={styles.layout}>
      {/* Sidebar Lateral Izquierdo */}
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.sidebarHeader} prefetch={true}>
          <ion-icon name="paper-plane" suppressHydrationWarning />
        </Link>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <ion-icon name={item.icon} suppressHydrationWarning />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <ion-icon name="log-out-outline" suppressHydrationWarning />
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className={styles.mainContent}>
        {/* Header Top */}
        <header className={styles.topHeader}>
          <div className={styles.topLeft}>
            <span className={styles.adminLabel}>ADMIN</span>
          </div>
          <div className={styles.topRight}>
            <Link href="/configuracion" prefetch={true} className={styles.settingsLink}>
              <ion-icon name="settings-outline" className={styles.settingsIcon} suppressHydrationWarning />
            </Link>
          </div>
        </header>

        {/* Contenido de la página */}
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
}
