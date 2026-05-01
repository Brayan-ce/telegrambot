'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './usuarios.module.css';

export default function Usuarios() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (buscar) params.set('buscar', buscar);
    if (estado) params.set('estado', estado);
    fetch(`/api/usuarios?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [buscar, estado, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const usuarios = data?.usuarios || [];
  const kpis = data?.kpis || {};
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    cargar();
  };

  return (
    <div className={styles.container}>
      {/* Header de la sección */}
      <div className={styles.headerSection}>
        <div className={styles.titleSection}>
          <ion-icon name="people-outline" suppressHydrationWarning />
          <span>GESTIÓN DE USUARIOS</span>
        </div>
        <Link href="/usuarios/crear" className={styles.btnPrimary}>
          <ion-icon name="add-outline" suppressHydrationWarning />
          Nuevo Usuario
        </Link>
      </div>

      {/* KPIs de usuarios */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="people" />
          </div>
          <div className={styles.kpiLabel}>Total Usuarios</div>
          <div className={styles.kpiValue}>{kpis.total_usuarios ?? 0}</div>
          <div className={styles.kpiTrend}>
            <ion-icon name="trending-up-outline" /> +12 este mes
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="person-add" />
          </div>
          <div className={styles.kpiLabel}>Usuarios Activos</div>
          <div className={styles.kpiValue}>{kpis.activos ?? 0}</div>
          <div className={styles.kpiTrend}>
            <ion-icon name="trending-up-outline" /> +5 esta semana
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>
            <ion-icon name="person-remove" />
          </div>
          <div className={styles.kpiLabel}>Inactivos</div>
          <div className={styles.kpiValue}>{kpis.inactivos ?? 0}</div>
          <div className={styles.kpiTrend} style={{ color: '#e53e3e' }}>
            <ion-icon name="trending-down-outline" /> -2 esta semana
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className={styles.filtersBar}>
        <div className={styles.searchBox}>
          <ion-icon name="search-outline" suppressHydrationWarning />
          <input type="text" placeholder="Buscar usuario..." value={buscar} onChange={(e) => { setBuscar(e.target.value); setPage(1); }} />
        </div>
        <div className={styles.filterGroup}>
          <select className={styles.select} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="baneado">Baneado</option>
          </select>
          <select className={styles.select}>
            <option>Ordenar por</option>
            <option>Nombre</option>
            <option>Créditos</option>
            <option>Última actividad</option>
          </select>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span>Mostrar</span>
          <select className={styles.selectSmall}>
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
          <span>registros</span>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Contacto</th>
                <th>Créditos</th>
                <th>Estado</th>
                <th>Última Actividad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Cargando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center',padding:'2rem',color:'#718096'}}>Sin resultados</td></tr>
              ) : usuarios.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <ion-icon name="person-circle" className={styles.userAvatar} suppressHydrationWarning />
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{user.nombre}</span>
                        <span className={styles.userUsername}>{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.email}>ID: {user.telegram_id}</span>
                  </td>
                  <td>
                    <span className={styles.creditos}>{user.creditos}</span>
                  </td>
                  <td>
                    <span className={`${styles.estado} ${styles[user.estado]}`}>
                      <ion-icon name={user.estado === 'activo' ? 'checkmark-circle' : 'close-circle'} suppressHydrationWarning />
                      {user.estado}
                    </span>
                  </td>
                  <td>
                    <span className={styles.actividad}>{user.ultima_actividad ? new Date(user.ultima_actividad).toLocaleString('es-PE') : '-'}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link href={`/usuarios/editar/${user.id}`} className={styles.btnIcon} title="Editar">
                        <ion-icon name="create-outline" suppressHydrationWarning />
                      </Link>
                      <Link href={`/usuarios/ver/${user.id}`} className={styles.btnIcon} title="Ver detalles">
                        <ion-icon name="eye-outline" suppressHydrationWarning />
                      </Link>
                      <button className={styles.btnIconDanger} title="Eliminar" onClick={() => handleEliminar(user.id)}>
                        <ion-icon name="trash-outline" suppressHydrationWarning />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className={styles.pagination}>
          <button className={styles.btnPage} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ion-icon name="chevron-back-outline" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${styles.btnPage} ${p === page ? styles.active : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className={styles.btnPage} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <ion-icon name="chevron-forward-outline" />
          </button>
        </div>
      </div>
    </div>
  );
}
