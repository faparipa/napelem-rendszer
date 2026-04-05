import { useState } from 'react';
import WarehouseMap from '../Worker/WarehouseMap';
import GoodsReceipt from '../Worker/GoodsReceipt';
import styles from './ManagerDashboard.module.css';

const ManagerDashboard = () => {
  const [highlightedSlotId, setHighlightedSlotId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className={styles.flexLayout}>
      <div className={styles.sidebar}>
        <GoodsReceipt
          onSuggestion={(id) => setHighlightedSlotId(id)}
          onSuccess={() => {
            setRefreshKey((prev) => prev + 1); // Térkép frissítése
            setHighlightedSlotId(null); // Villogás leállítása
          }}
        />
      </div>
      <div className={styles.mapArea}>
        <WarehouseMap key={refreshKey} highlightedSlotId={highlightedSlotId} />
      </div>
    </div>
  );
};

export default ManagerDashboard;
