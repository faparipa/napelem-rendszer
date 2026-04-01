import { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './WarehouseMap.module.css';

const WarehouseMap = ({ highlightedSlotId }) => {
  const [allSlots, setAllSlots] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [qty, setQty] = useState(0);
  const [selectedPartId, setSelectedPartId] = useState('');

  const token = localStorage.getItem('token');

  // Dinamikus határértékek kiszámítása
  const maxRows =
    allSlots.length > 0 ? Math.max(...allSlots.map((s) => s.row_num)) : 0;
  const maxCols =
    allSlots.length > 0 ? Math.max(...allSlots.map((s) => s.col_num)) : 0;
  const maxLevels =
    allSlots.length > 0 ? Math.max(...allSlots.map((s) => s.level_num)) : 0;

  const range = (end) => Array.from({ length: end }, (_, i) => i + 1);

  useEffect(() => {
    fetchStatus();
    fetchParts();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('http://localhost:8000/warehouse/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllSlots(res.data);
    } catch (err) {
      console.error('Hiba a raktár lekérésekor', err);
    }
  };

  const fetchParts = async () => {
    try {
      const res = await axios.get('http://localhost:8000/parts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setParts(res.data);
    } catch (err) {
      console.error('Hiba az alkatrészek lekérésekor', err);
    }
  };

  const handleUpdateStock = async (amount) => {
    try {
      const partToUse = selectedPartId || editingSlot.part_id;
      if (!partToUse && amount > 0) {
        alert('Kérlek válassz ki egy alkatrészt a bevételezéshez!');
        return;
      }

      await axios.post(
        `http://localhost:8000/warehouse/update-stock?slot_id=${editingSlot.id}&part_id=${partToUse}&quantity=${amount}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditingSlot(null);
      setQty(0);
      fetchStatus();
      alert('Raktárkészlet sikeresen frissítve!');
    } catch (err) {
      alert('Hiba történt: ' + (err.response?.data?.detail || 'Hálózati hiba'));
    }
  };

  const filteredSlots = allSlots.filter(
    (s) =>
      selectedPos &&
      s.row_num === selectedPos.row &&
      s.col_num === selectedPos.col
  );

  // Kijelölés figyelése (ha a Beérkezés panelről jön adat)
  useEffect(() => {
    if (highlightedSlotId) {
      const slot = allSlots.find((s) => s.id === highlightedSlotId);
      if (slot) {
        setSelectedPos({ row: slot.row_num, col: slot.col_num });
      }
    }
  }, [highlightedSlotId, allSlots]);

  return (
    <div className={styles.container}>
      <h2>
        Dinamikus Raktár Térkép ({maxRows}x{maxCols})
      </h2>

      <div className={styles.gridWrapper}>
        <div
          className={styles.mainGrid}
          style={{ gridTemplateColumns: `100px repeat(${maxCols}, 1fr)` }}
        >
          <div className={styles.emptyHeader}></div>
          {range(maxCols).map((c) => (
            <div key={`hc-${c}`} className={styles.colHeader}>
              {c}. Oszlop
            </div>
          ))}

          {range(maxRows).map((rowNum) => (
            <div key={`row-wrap-${rowNum}`} style={{ display: 'contents' }}>
              <div className={styles.rowHeader}>{rowNum}. Sor</div>
              {range(maxCols).map((colNum) => {
                const isActive =
                  selectedPos?.row === rowNum && selectedPos?.col === colNum;
                const hasItems = allSlots.some(
                  (s) =>
                    s.row_num === rowNum &&
                    s.col_num === colNum &&
                    s.current_quantity > 0
                );

                return (
                  <div
                    key={`${rowNum}-${colNum}`}
                    className={`${styles.gridCell} ${
                      isActive ? styles.activeCell : ''
                    } ${hasItems ? styles.hasItems : ''}`}
                    onClick={() => setSelectedPos({ row: rowNum, col: colNum })}
                  >
                    <small>
                      S{rowNum}-O{colNum}
                    </small>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedPos && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <h3>
              📍 Sor {selectedPos.row}, Oszlop {selectedPos.col} metszete
            </h3>
            <button onClick={() => setSelectedPos(null)}>Bezárás</button>
          </div>

          {range(maxLevels)
            .reverse()
            .map((l) => (
              <div key={l} className={styles.levelRow}>
                <div className={styles.levelLabel}>{l}. Szint</div>
                <div className={styles.rekeszContainer}>
                  {filteredSlots
                    .filter((s) => s.level_num === l)
                    .sort((a, b) => a.rekesz_num - b.rekesz_num)
                    .map((slot) => {
                      // Itt határozzuk meg a villogást az aktuális slot alapján
                      const isBlinking = slot.id === highlightedSlotId;

                      return (
                        <div
                          key={slot.id}
                          className={`${styles.rekeszBox} ${
                            isBlinking ? styles.blink : ''
                          } ${
                            slot.current_quantity > 0
                              ? styles.occupied
                              : styles.empty
                          }`}
                          onClick={() => {
                            setEditingSlot(slot);
                            setSelectedPartId(slot.part_id || '');
                            setQty(0);
                          }}
                        >
                          <div className={styles.shortId}>
                            #{slot.row_num}
                            {slot.col_num}
                            {slot.level_num}
                            {slot.rekesz_num}
                          </div>
                          <strong>R-{slot.rekesz_num}</strong>
                          <span>
                            {slot.current_quantity > 0
                              ? `${slot.part?.name} (${slot.current_quantity} db)`
                              : 'Üres'}
                          </span>
                          <small className={styles.readableId}>
                            {slot.readable_id}
                          </small>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      )}

      {editingSlot && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Rekesz kezelése: {editingSlot.readable_id}</h3>
            <div className={styles.inputGroup}>
              <label>Mennyiség:</label>
              <input
                type='number'
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min='1'
              />
            </div>
            <div className={styles.modalButtons}>
              <button
                onClick={() => handleUpdateStock(parseInt(qty))}
                className={styles.btnGreen}
              >
                ➕ Bevételezés
              </button>
              <button
                onClick={() => setEditingSlot(null)}
                className={styles.btnGray}
              >
                Mégse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseMap;
