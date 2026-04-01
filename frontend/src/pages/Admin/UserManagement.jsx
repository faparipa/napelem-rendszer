import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import styles from './UserManagement.module.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(''); // Felhasználónév tárolása a védelemhez
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'Szakember',
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // A backendtől függően az id vagy a sub mező tartalmazza az azonosítót
        setCurrentUserId(decoded.id || decoded.sub);
        // Kinyerjük a felhasználónevet is a biztosabb azonosításhoz
        setCurrentUsername(decoded.username || '');
      } catch (err) {
        console.error('Token dekódolási hiba:', err);
      }
    }
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:8000/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Hiba a lekéréskor:', err);
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditData({
      role: user.role,
      password: '',
    });
  };

  const handleUpdate = async (id) => {
    try {
      const payload = {
        role: editData.role,
        ...(editData.password && { password: editData.password }),
      };

      await axios.put(`http://localhost:8000/users/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      alert('Sikertelen módosítás: ' + (err.response?.data?.detail || 'Hiba'));
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/users', newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNewUser({ username: '', password: '', role: 'Szakember' });
      fetchUsers();
      alert('Felhasználó sikeresen hozzáadva!');
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Sikertelen mentés'));
    }
  };

  const handleDelete = async (user) => {
    // Kettős védelem: ID vagy NÉV alapján (beleértve a fix 'vargaistvan'-t is)
    if (
      user.id === currentUserId ||
      user.username === currentUsername ||
      user.username === 'vargaistvan'
    ) {
      alert('Saját magadat nem törölheted ki a rendszerből!');
      return;
    }

    if (!window.confirm(`Biztosan törlöd a(z) ${user.username} felhasználót?`))
      return;
    try {
      await axios.delete(`http://localhost:8000/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Hiba a törléskor');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.actionHeader}>
        <h2>Felhasználók kezelése</h2>
      </div>

      <form
        className={styles.formInline}
        onSubmit={handleAddUser}
        autoComplete='off'
      >
        <h4>Új felhasználó hozzáadása:</h4>
        <div className={styles.formGrid}>
          <input
            className={styles.input}
            placeholder='Felhasználónév'
            name='new_user_name_unique'
            value={newUser.username}
            autoComplete='off'
            onChange={(e) =>
              setNewUser({ ...newUser, username: e.target.value })
            }
            required
          />
          <input
            className={styles.input}
            type='password'
            placeholder='Jelszó'
            name='new_user_password_unique'
            value={newUser.password}
            autoComplete='new-password'
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
            required
          />
          <select
            className={styles.select}
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          >
            <option value='Adminisztrator'>Adminisztrátor</option>
            <option value='Szakember'>Szakember</option>
            <option value='Raktarvezeto'>Raktárvezető</option>
            <option value='Raktaros'>Raktáros</option>
          </select>
          <button type='submit' className={styles.addBtn}>
            Hozzáadás
          </button>
        </div>
      </form>

      <table className={styles.userTable}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Felhasználónév</th>
            <th>Szerepkör</th>
            <th>Új Jelszó</th>
            <th>Műveletek</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            // Itt dől el, hogy az adott sor a bejelentkezett felhasználóé-e
            const isMe =
              user.id === currentUserId ||
              user.username === 'vargaistvan' ||
              user.username === currentUsername;

            return (
              <tr key={user.id} className={isMe ? styles.currentUserRow : ''}>
                <td>
                  {user.id} {isMe && ' (Ön)'}
                </td>
                <td>{user.username}</td>
                <td>
                  {editingId === user.id ? (
                    <select
                      className={styles.select}
                      value={editData.role}
                      onChange={(e) =>
                        setEditData({ ...editData, role: e.target.value })
                      }
                    >
                      <option value='Adminisztrator'>Adminisztrátor</option>
                      <option value='Szakember'>Szakember</option>
                      <option value='Raktarvezeto'>Raktárvezető</option>
                      <option value='Raktaros'>Raktáros</option>
                    </select>
                  ) : (
                    <span
                      className={
                        user.role === 'Adminisztrator' ? styles.adminBadge : ''
                      }
                    >
                      {user.role}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === user.id ? (
                    <input
                      type='text'
                      className={styles.inputSmall}
                      placeholder='Új jelszó...'
                      value={editData.password}
                      onChange={(e) =>
                        setEditData({ ...editData, password: e.target.value })
                      }
                    />
                  ) : (
                    <span style={{ color: '#ccc' }}>********</span>
                  )}
                </td>
                <td className={styles.btnGroup}>
                  {editingId === user.id ? (
                    <>
                      <button
                        onClick={() => handleUpdate(user.id)}
                        className={styles.saveBtn}
                      >
                        Mentés
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className={styles.cancelBtn}
                      >
                        Mégse
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(user)}
                        className={styles.editBtn}
                      >
                        Módosítás
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className={styles.deleteBtn}
                        disabled={isMe} // A gomb letiltása, ha "Ön" az
                        title={isMe ? 'Saját magát nem törölheti' : ''}
                      >
                        Törlés
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
