import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProjectRequirements from '../../components/ProjectRequirements';
import styles from './WorkerDashboard.module.css';
import LogoutButton from '../../components/LogoutButton';
import StorageManagement from '../../components/StorageManagement';

const WorkerDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [pickingList, setPickingList] = useState([]);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [projectDetails, setProjectDetails] = useState({ can_complete: false });

  const loadProjects = async () => {
    try {
      const res = await axios.get(
        'http://localhost:8000/warehouse/reports/project-requirements',
        { headers }
      );
      const unique = [];
      const map = new Map();
      for (const item of res.data) {
        if (!map.has(item.project_id)) {
          map.set(item.project_id, true);
          unique.push({ id: item.project_id, location: item.location });
        }
      }
      setProjects(unique);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSelectProject = async (pId) => {
    try {
      const res = await axios.get(
        `http://localhost:8000/warehouse/projects/${pId}/picking-list`,
        { headers }
      );
      setPickingList(res.data.picking_steps);
      setProjectDetails(res.data.project_info);
      setSelectedProject(pId);
    } catch (err) {
      console.error('Hiba a projekt részleteinek lekérésekor:', err);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Lezárod a kiszedést?')) return;
    try {
      await axios.patch(
        `http://localhost:8000/warehouse/projects/${selectedProject}/confirm-and-close`,
        {},
        { headers }
      );

      // AZONNAL nullázzuk az állapotokat, hogy ne lehessen újra kattintani
      setSelectedProject(null);
      setPickingList([]);
      setProjectDetails({ can_complete: false }); // Reseteljük a gomb állapotát is

      // Csak ezután töltsük újra a listát a háttérben
      await loadProjects();

      alert('Kész!');
    } catch (err) {
      alert('Hiba a lezárás során!');
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <h2>👷 Raktáros Munkalap</h2>
        <LogoutButton />
      </nav>

      <div className={styles.dashboardGrid}>
        <div className={styles.leftPanel}>
          <h3>Választható Projektek</h3>
          <div className={styles.projectSelector}>
            <ProjectRequirements
              onSelect={(id) => handleSelectProject(id)}
              selectedId={selectedProject}
            />
          </div>
        </div>
        <div className={styles.rightPanel}>
          <h3>📦 Kiszedési Útvonal</h3>
          {selectedProject ? (
            <>
              <table className={styles.pickingTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Helyszín</th>
                    <th>Alkatrész</th>
                    <th>Készleten</th>
                    <th>Szükséges</th>
                  </tr>
                </thead>
                <tbody>
                  {pickingList.map((item, index) => (
                    <tr
                      key={index}
                      style={
                        item.is_missing ? { backgroundColor: '#ffe6e6' } : {}
                      }
                    >
                      <td>
                        {item.is_missing ? (
                          <span style={{ color: 'red', fontWeight: 'bold' }}>
                            NINCS KÉSZLETEN
                          </span>
                        ) : (
                          item.location
                        )}
                      </td>
                      <td>{item.part_name}</td>
                      <td style={item.is_missing ? { color: 'red' } : {}}>
                        {item.stock_qty} db
                      </td>
                      <td>{item.required_qty} db</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                // Dinamikusan fűzzük össze az osztályneveket
                className={`${styles.btnComplete} ${
                  projectDetails?.can_complete ? styles.active : styles.disabled
                }`}
                disabled={!projectDetails?.can_complete}
                onClick={handleComplete}
              >
                {projectDetails?.can_complete
                  ? '✓ Kiszedés Kész'
                  : '⚠ Hiányzó alkatrészek'}
              </button>
            </>
          ) : (
            <p className={styles.emptyHint}>Válassz projektet!</p>
          )}
        </div>
      </div>
      <div className={styles.content}>
        <StorageManagement />
      </div>
    </div>
  );
};

export default WorkerDashboard;
