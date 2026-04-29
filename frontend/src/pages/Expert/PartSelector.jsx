import React, { useState } from 'react';
import styles from './ExpertDashboard.module.css';

const PartSelector = ({ parts, onAdd }) => {
  // Egy objektumban tároljuk a mennyiségeket: { [partId]: quantity }
  const [quantities, setQuantities] = useState({});

  const handleQtyChange = (partId, value) => {
    setQuantities((prev) => ({
      ...prev,
      [partId]: parseInt(value) || 1, // Ha üres, alapértelmezetten 1
    }));
  };

  return (
    <div className={styles.section}>
      <h3>Alkatrészek válogatása</h3>
      <table className={styles.partTable}>
        <thead>
          <tr>
            <th>Alkatrész név</th>
            <th>Mennyiség</th>
            <th>Hozzáadás</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id}>
              <td>
                {p.name} <small>({p.stock} db készleten)</small>
              </td>
              <td>
                <input
                  type='number'
                  value={quantities[p.id] || 1} // A state-ből olvassuk
                  min='1'
                  max={p.stock} // Opcionális: ne engedjük a készlet fölé
                  onChange={(e) => handleQtyChange(p.id, e.target.value)}
                  className={styles.qtyInput}
                />
              </td>
              <td>
                <button
                  className={styles.addSmallBtn}
                  onClick={() => {
                    const qty = quantities[p.id] || 1;
                    onAdd(p.id, qty);
                  }}
                >
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartSelector;
