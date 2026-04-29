import React from 'react';
import styles from './InboundHistory.module.css'; // Használhatod a meglévő stílust

const InboundHistory = ({ history }) => {
  if (history.length === 0) return null;

  return (
    <div className={styles.resultList}>
      <h4>✅ Bevételezési előzmények:</h4>
      {[...history].reverse().map((entry, hIdx) => (
        <div key={hIdx} className={styles.historyBlock}>
          <h5>
            📦 {entry.partName} ({entry.totalQuantity} db)
          </h5>
          {entry.allocation.map((item, index) => (
            <div key={index} className={styles.resultItem}>
              <span>
                <span className={styles.rekeszId}>{item.readable_id}</span>{' '}
                rekeszbe:
              </span>
              <strong>{item.allocated_quantity} db</strong>
            </div>
          ))}
          <hr className={styles.divider} />
        </div>
      ))}
    </div>
  );
};

export default InboundHistory;
