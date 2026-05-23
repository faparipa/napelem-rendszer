// // WarehouseSetup.jsx
import { useState } from 'react';
import styles from './Warehouse.module.css';
import WarehouseExpansion from './WarehouseExpansion';
import useWarehouseStore from '../store/useWarehouseStore';

const WarehouseSetup = () => {
  const setupWarehouse = useWarehouseStore((state) => state.setupWarehouse);
  const [dims, setDims] = useState({
    rows: 5,
    cols: 4,
    levels: 3,
    slotsPerLevel: 3,
  });

  const handleSetup = async () => {
    if (
      !window.confirm(
        'Biztosan legenerálod a raktárhelyeket? Csak egyszer tehető meg!'
      )
    )
      return;
    await setupWarehouse(dims);
  };

  return (
    <div className={styles.setupCard}>
      <h3>1.d) Raktár elrendezés konfigurálása</h3>
      <div className={styles.warningBox}>
        <strong>⚠️ Figyelem!</strong>
        <p>A generálás során létrehozott minden új rekesz üres lesz (0 db).</p>
        <p>
          Ha az adatbázis már tartalmaz rekeszeket, a művelet nem hajtható
          végre.
        </p>
      </div>

      <div className={styles.inputGrid}>
        <div className={styles.field}>
          <label>Sorok száma:</label>
          <input
            type='number'
            value={dims.rows}
            onChange={(e) =>
              setDims({ ...dims, rows: parseInt(e.target.value) || 0 })
            }
            min='1'
          />
        </div>
        <div className={styles.field}>
          <label>Oszlopok száma:</label>
          <input
            type='number'
            value={dims.cols}
            onChange={(e) =>
              setDims({ ...dims, cols: parseInt(e.target.value) || 0 })
            }
            min='1'
          />
        </div>
        <div className={styles.field}>
          <label>Szintek (polcok):</label>
          <input
            type='number'
            value={dims.levels}
            onChange={(e) =>
              setDims({ ...dims, levels: parseInt(e.target.value) || 0 })
            }
            min='1'
          />
        </div>
        <div className={styles.field}>
          <label>Rekeszek / polc:</label>
          <input
            type='number'
            value={dims.slotsPerLevel}
            onChange={(e) =>
              setDims({ ...dims, slotsPerLevel: parseInt(e.target.value) || 0 })
            }
            min='1'
          />
        </div>
      </div>

      <button onClick={handleSetup} className={styles.setupBtn}>
        🚀 Raktárhelyek Generálása
      </button>
      <hr className={styles.separator} />
      <WarehouseExpansion />
    </div>
  );
};

export default WarehouseSetup;
