import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // npm install jwt-decode
import styles from './Login.module.css'; // MODUL IMPORTÁLÁSA

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const res = await axios.post('http://localhost:8000/login', formData);
      localStorage.setItem('token', res.data.access_token);

      const decoded = jwtDecode(res.data.access_token);
      const userRole = decoded.role;

      console.log('Sikeres belépés. Szerepkör:', userRole);

      // SZEREPKÖR ALAPÚ IRÁNYÍTÁS
      switch (userRole) {
        case 'Adminisztrator':
          navigate('/admin');
          break;
        case 'Raktarvezeto':
          navigate('/manager');
          break;
        case 'Raktaros':
          navigate('/worker');
          break;
        case 'Szakember':
          navigate('/expert');
          break;
        default:
          alert('Ismeretlen szerepkör, kérjük keresse az admint!');
          navigate('/login');
      }
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Sikertelen belépés'));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 className={styles.title}>Bejelentkezés</h2>
          <input
            type='text'
            placeholder='Felhasználónév'
            onChange={(e) => setUsername(e.target.value)}
            required
            className={styles.inputField}
          />
          <input
            type='password'
            placeholder='Jelszó'
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.inputField}
          />
          <button type='submit' className={styles.submitBtn}>
            Belépés
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
