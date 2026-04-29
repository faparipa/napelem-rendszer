import { useNavigate } from 'react-router-dom';
import styles from './LogoutButton.module.css';

const LogoutButton = ({ className }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Valóban ki szeretne jelentkezni?')) {
      localStorage.clear();
      navigate('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`${styles.logoutBtn} ${className}`}
      title='Kijelentkezés'
    >
      <span className={styles.icon}>🚪</span>
      <span className={styles.text}>Kijelentkezés</span>
    </button>
  );
};

export default LogoutButton;
