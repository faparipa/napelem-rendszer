import React, { useState, useEffect } from 'react';
import styles from './StorageManagement.module.css';
import useWorkerStore from '../pages/store/useWorkerStore';

const StorageManagement = () => {
  const { slotsStatus, fetchSlotsStatus } = useWorkerStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSlotsStatus();
  }, [fetchSlotsStatus]);

  const filteredSlots = slotsStatus.filter(
    (slot) =>
      slot.readable_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (slot.part_name &&
        slot.part_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>📦 Rekeszek és Tárhelyek Állapota</h2>
        <input
          type='text'
          placeholder='Keresés rekesz vagy alkatrész alapján...'
          className={styles.searchInput}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <div className={styles.slotGrid}>
        {filteredSlots.map((slot) => {
          const current = slot.current_quantity || 0;
          const max = slot.max_per_slot || 0;
          const occupancy = max > 0 ? Math.round((current / max) * 100) : 0;

          return (
            <div key={slot.id} className={styles.slotCard}>
              <div className={styles.slotId}>{slot.readable_id}</div>

              <div className={styles.partName}>
                {slot.part_name ? (
                  <strong>{slot.part_name}</strong>
                ) : (
                  <span className={styles.empty}>Üres rekesz</span>
                )}
              </div>

              <div className={styles.quantityInfo}>
                {current} / {max > 0 ? max : '0'} db
              </div>

              <div className={styles.progressContainer}>
                <div
                  className={styles.progressBar}
                  style={{
                    width: `${occupancy > 100 ? 100 : occupancy}%`,
                    backgroundColor:
                      occupancy >= 100
                        ? '#ef4444'
                        : occupancy > 0
                        ? '#3b82f6'
                        : '#e2e8f0',
                  }}
                ></div>
              </div>
              <small>{occupancy}% telítettség</small>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StorageManagement;
