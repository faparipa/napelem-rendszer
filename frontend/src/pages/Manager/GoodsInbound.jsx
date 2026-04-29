import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './GoodsInbound.module.css';
import InboundHistory from '../../components/InboundHistory';

const GoodsInbound = () => {
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState({ part_id: '', quantity: '' });
  const [allocationResult, setAllocationResult] = useState(null);
  const [inboundHistory, setInboundHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchParts = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        };
        const res = await axios.get('http://localhost:8000/warehouse/parts', {
          headers,
        });
        setParts(res.data);
      } catch (err) {
        console.error('Hiba az alkatrészek betöltésekor', err);
      }
    };
    fetchParts();
  }, []);

  const handleAutoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const headers = {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    };

    try {
      // Megkeressük az alkatrész nevét a listából a megjelenítéshez
      const selectedPart = parts.find((p) => p.id === parseInt(form.part_id));

      const response = await axios.post(
        'http://localhost:8000/warehouse/auto-inbound',
        {
          part_id: parseInt(form.part_id),
          quantity: parseInt(form.quantity),
        },
        { headers }
      );

      // ÚJ OBJEKTUM: Alkatrész név + mennyiség + az elosztás részletei
      const newEntry = {
        partName: selectedPart?.name || 'Ismeretlen alkatrész',
        totalQuantity: form.quantity,
        allocation: response.data.allocation,
      };

      // HOZZÁADÁS az előzményekhez (nem felülírás!)
      setInboundHistory((prev) => [...prev, newEntry]);

      setForm({ part_id: '', quantity: '' });
      alert('Sikeres automatikus bevételezés!');
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Hiba történt'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>📥 Automata Bevételezés</h3>

      <form onSubmit={handleAutoSubmit} className={styles.form}>
        <label className={styles.label}>
          Alkatrész:
          <select
            className={styles.select}
            value={form.part_id}
            onChange={(e) => setForm({ ...form, part_id: e.target.value })}
            required
          >
            <option value=''>Válasszon alkatrészt...</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Beérkező mennyiség (db):
          <input
            type='number'
            className={styles.input}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            min='1'
            required
          />
        </label>

        <button type='submit' className={styles.submitBtn} disabled={loading}>
          {loading ? 'Feldolgozás...' : 'Optimális elosztás és mentés'}
        </button>
      </form>

      <InboundHistory history={inboundHistory} />
    </div>
  );
};

export default GoodsInbound;
