import { useState } from 'react';
import axios from 'axios';
import styles from './ExpertDashboard.module.css'; // Használhatjuk ugyanazt a modult vagy egy újat

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated }) => {
  const [newProj, setNewProj] = useState({
    location: '',
    customer_name: '',
    customer_phone: '',
    description: '',
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/expert/projects', newProj, {
        headers,
      });
      setNewProj({
        location: '',
        customer_name: '',
        customer_phone: '',
        description: '',
      });
      onProjectCreated(); // Frissíti a listát a szülő komponensben
      onClose(); // Bezárja a modalt
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Szerver hiba'));
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Új projekt felvétele</h2>
        <form onSubmit={handleSubmit}>
          <input
            type='text'
            placeholder='Helyszín'
            required
            value={newProj.location}
            onChange={(e) =>
              setNewProj({ ...newProj, location: e.target.value })
            }
          />
          <input
            type='text'
            placeholder='Megrendelő neve'
            required
            value={newProj.customer_name}
            onChange={(e) =>
              setNewProj({ ...newProj, customer_name: e.target.value })
            }
          />
          <input
            type='text'
            placeholder='Telefonszám'
            required
            value={newProj.customer_phone}
            onChange={(e) =>
              setNewProj({ ...newProj, customer_phone: e.target.value })
            }
          />
          <textarea
            placeholder='Rövid leírás...'
            value={newProj.description}
            onChange={(e) =>
              setNewProj({ ...newProj, description: e.target.value })
            }
          />
          <div className={styles.modalButtons}>
            <button type='submit' className={styles.saveBtn}>
              Létrehozás
            </button>
            <button
              type='button'
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Mégse
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
