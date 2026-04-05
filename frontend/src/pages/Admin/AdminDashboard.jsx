import { Link, Outlet, useNavigate } from 'react-router-dom';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <h3>Admin Panel</h3>
        <nav className={styles.nav}>
          <Link to='/admin/users' className={styles.navLink}>
            👤 Felhasználók kezelése
          </Link>
          <Link to='/admin/parts' className={styles.navLink}>
            📦 Alkatrészek kezelése
          </Link>
          <Link to='/admin/manager' className={styles.navLink}>
            🏢 Raktár Térkép
          </Link>
          <Link to='/admin/expert' className={styles.navLink}>
            👤 Szakember
          </Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Kijelentkezés
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.content}>
        <header className={styles.header}>
          <h1>Vezérlőpult</h1>
        </header>
        <section>
          <Outlet />
          {window.location.pathname === '/admin' && (
            <p>
              Üdvözöljük az adminisztrációs felületen! Válasszon a bal oldali
              menüből.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
