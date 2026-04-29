import { useState } from 'react';
import axios from 'axios';
import styles from './WarehouseExpansion.module.css';

const WarehouseExpansion = () => {
  const [config, setConfig] = useState({
    addRows: 0,
    addCols: 0,
    levels: 3,
    slotsPerLevel: 4,
  });
  const token = localStorage.getItem('token');

  const handleExpand = async () => {
    // JAVÍTÁS: Az 'expansion' helyett a 'config'-ból vesszük ki az adatokat
    const { addRows, addCols, levels, slotsPerLevel } = config;

    if (
      !window.confirm(
        `Biztosan hozzáadsz ${addRows} új sort és ${addCols} új oszlopot?`
      )
    )
      return;

    try {
      await axios.post(
        `http://localhost:8000/warehouse/expand-warehouse`,
        null,
        {
          params: {
            // A backend Query paraméterei snake_case formátumúak
            add_rows: addRows,
            add_cols: addCols,
            levels: levels,
            slots_per_level: slotsPerLevel,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      alert('Bővítés sikeres!');
    } catch (err) {
      console.error(err);
      alert('Hiba történt a bővítés során.');
    }
  };

  return (
    <div className={styles.setupCard}>
      <h3>Raktár bővítése egyedi kiosztással</h3>
      <div className={styles.inputGrid}>
        <label>
          Plusz sorok:
          <input
            type='number'
            value={config.addRows}
            onChange={(e) => setConfig({ ...config, addRows: +e.target.value })}
          />
        </label>
        <label>
          Plusz oszlopok:
          <input
            type='number'
            value={config.addCols}
            onChange={(e) => setConfig({ ...config, addCols: +e.target.value })}
          />
        </label>

        <label>
          Polcok (szintek) száma:
          <input
            type='number'
            value={config.levels}
            onChange={(e) => setConfig({ ...config, levels: +e.target.value })}
          />
        </label>
        <label>
          Rekeszek száma / polc:
          <input
            type='number'
            value={config.slotsPerLevel}
            onChange={(e) =>
              setConfig({ ...config, slotsPerLevel: +e.target.value })
            }
          />
        </label>
      </div>
      <button onClick={handleExpand} className={styles.expandBtn}>
        Bővítés indítása
      </button>
    </div>
  );
};

export default WarehouseExpansion;
