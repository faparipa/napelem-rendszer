import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './Warehouse.module.css';
import ProjectRequirements from '../../components/ProjectRequirements';

const MissingPartsReport = () => {
  const [report, setReport] = useState([]);
  const token = localStorage.getItem('token');
  useEffect(() => {
    const fetchReport = async () => {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      };
      const res = await axios.get(
        'http://localhost:8000/warehouse/reports/missing-parts',
        { headers }
      );
      setReport(res.data);
    };
    fetchReport();
  }, []);
  console.log(report);

  return (
    <div className={styles.container}>
      <ProjectRequirements />
      <h3>B.3 & B.4: Beszerzési Várólista (Hiányzó alkatrészek)</h3>
      <p>
        Az alábbi táblázat mutatja azokat az alkatrészeket, amelyekből nincs
        elég a raktárban a lefoglalt projektekhez.
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Alkatrész Neve</th>
            <th>Raktáron (db)</th>
            <th>Projekt Igény (db)</th>
            <th style={{ color: '#e74c3c' }}>Hiány / Rendelendő</th>
          </tr>
        </thead>
        <tbody>
          {report.length === 0 ? (
            <tr>
              <td colSpan='4' style={{ textAlign: 'center' }}>
                Mindenből van elég készlet! ✅
              </td>
            </tr>
          ) : (
            report.map((item, idx) =>
              item.missing_quantity > 0 ? (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.current_stock}</td>
                  <td>{item.required_by_projects}</td>
                  <td style={{ fontWeight: 'bold', color: '#e74c3c' }}>
                    {item.missing_quantity} db
                  </td>
                </tr>
              ) : null
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MissingPartsReport;
