//
import React, { useEffect } from 'react';
import ProjectRequirements from '../../components/ProjectRequirements';
import styles from './WorkerDashboard.module.css';
import LogoutButton from '../../components/LogoutButton';
import StorageManagement from '../../components/StorageManagement';
import useWorkerStore from '../store/useWorkerStore'; // Ellenőrizd az elérési utat!

const WorkerDashboard = () => {
  const {
    selectedProject,
    pickingList,
    projectDetails,
    loadProjects,
    selectProject,
    completePicking,
  } = useWorkerStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleComplete = () => {
    if (window.confirm('Lezárod a kiszedést?')) {
      completePicking();
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
              onSelect={(id) => selectProject(id)}
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
