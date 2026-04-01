import { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './GoodsReceipt.module.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const GoodsReceipt = ({ onSuggestion, onSuccess }) => {
  const [parts, setParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [steps, setSteps] = useState([]); // A szétosztási terv
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    const res = await axios.get('http://localhost:8000/parts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setParts(res.data);
  };

  const handlePlan = async () => {
    if (!selectedPartId || quantity <= 0) return;
    try {
      const res = await axios.get(
        `http://localhost:8000/warehouse/suggest-split/${selectedPartId}?quantity=${quantity}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSteps(res.data);
      if (res.data.length > 0) onSuggestion(res.data[0].slot_id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Hiba');
    }
  };

  const confirmStep = async (step) => {
    try {
      await axios.post(
        `http://localhost:8000/warehouse/update-stock?slot_id=${step.slot_id}&part_id=${selectedPartId}&quantity=${step.quantity}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const remainingSteps = steps.filter((s) => s.slot_id !== step.slot_id);
      setSteps(remainingSteps);

      if (remainingSteps.length > 0) {
        onSuggestion(remainingSteps[0].slot_id); // Következő villogtatása
      } else {
        alert('Minden tétel rögzítve!');
        setQuantity(1);
        setSelectedPartId('');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      alert('Sikertelen mentés!');
    }
  };

  const generatePDF = () => {
    if (steps.length === 0) return;

    const doc = new jsPDF();

    // Fejléc
    doc.setFontSize(18);
    doc.text('Bevételezési Rakodási Terv', 14, 20);

    doc.setFontSize(11);
    doc.text(`Dátum: ${new Date().toLocaleString('hu-HU')}`, 14, 30);
    doc.text(
      `Alkatrész: ${
        parts.find((p) => p.id === parseInt(selectedPartId))?.name ||
        'Ismeretlen'
      }`,
      14,
      37
    );

    // Táblázat adatai
    const tableRows = steps.map((s, idx) => [
      idx + 1,
      s.readable_id,
      `${s.quantity} db`,
      s.reason,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['#', 'Helyszín (Rekesz)', 'Mennyiség', 'Megjegyzés']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [46, 204, 113] },
    });

    doc.save(`rakodasi_terv_${selectedPartId}.pdf`);
  };

  return (
    <div className={styles.receiptCard}>
      <h3>📥 Beérkezés Felosztása</h3>
      <div className={styles.formGroup}>
        <label>Alkatrész:</label>
        <select
          value={selectedPartId}
          onChange={(e) => setSelectedPartId(e.target.value)}
        >
          <option value=''>Válassz...</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label>Össz Mennyiség:</label>
        <input
          type='number'
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <button onClick={handlePlan} className={styles.suggestBtn}>
        Terv Készítése
      </button>
      {steps.length > 0 && (
        <button onClick={generatePDF} className={styles.printBtn}>
          🖨️ Rakodási lista nyomtatása (PDF)
        </button>
      )}

      {steps.length > 0 && (
        <div className={styles.stepList}>
          <p>
            <small>Kattints az OK-ra az elhelyezés után:</small>
          </p>
          {steps.map((step, idx) => (
            <div
              key={idx}
              className={`${styles.stepItem} ${
                idx === 0 ? styles.activeStep : ''
              }`}
            >
              <div
                onClick={() => onSuggestion(step.slot_id)}
                style={{ cursor: 'pointer' }}
              >
                <strong>{step.quantity} db</strong> ➔ {step.readable_id}
                <div className={styles.reason}>{step.reason}</div>
              </div>
              <button onClick={() => confirmStep(step)}>OK</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoodsReceipt;
