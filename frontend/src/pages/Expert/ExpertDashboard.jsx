import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import styles from './ExpertDashboard.module.css';
import { generateProjectPDF } from './exportUtils';
import PartSelector from './PartSelector';
import ProjectPartsList from './ProjectPartsList';
import { useNavigate } from 'react-router-dom';
import CreateProjectModal from './CreateProjectModal';

const ExpertDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [parts, setParts] = useState([]);
  const [projectParts, setProjectParts] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [calc, setCalc] = useState({ hours: 0, hourlyRate: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  // --- Adatlekérő függvények ---
  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:8000/expert/projects', {
        headers,
      });
      setProjects(res.data);
      // Ha van kiválasztott projekt, frissítjük az adatait a listából
      if (selectedProject) {
        const updated = res.data.find((p) => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (err) {
      console.error('Projektek lekérése sikertelen', err);
    }
  }, [headers, selectedProject]);

  const fetchParts = useCallback(async () => {
    try {
      const res = await axios.get(
        'http://localhost:8000/expert/parts-with-stock',
        { headers }
      );
      setParts(res.data);
    } catch (err) {
      console.error('Alkatrészek lekérése sikertelen', err);
    }
  }, [headers]);

  const fetchProjectParts = useCallback(
    async (id) => {
      try {
        const res = await axios.get(
          `http://localhost:8000/expert/projects/${id}/parts`,
          { headers }
        );
        setProjectParts(res.data);
      } catch (err) {
        console.error('Projekt alkatrészek lekérése sikertelen', err);
      }
    },
    [headers]
  );

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchProjects();
      fetchParts();
    }
  }, [token, navigate, fetchParts]); // fetchProjects-et szándékosan kihagyjuk a végtelen ciklus elkerülésére, vagy useCallback-el fixáljuk

  useEffect(() => {
    if (selectedProject) fetchProjectParts(selectedProject.id);
  }, [selectedProject, fetchProjectParts]);

  // --- Alkatrész műveletek ---
  const handleAddPart = async (partId, qty) => {
    if (!qty || qty <= 0)
      return alert('Kérlek adj meg egy érvényes mennyiséget!');
    try {
      await axios.post(
        `http://localhost:8000/expert/projects/${selectedProject.id}/parts`,
        { part_id: partId, quantity: parseInt(qty) },
        { headers }
      );
      fetchProjectParts(selectedProject.id);
      fetchProjects(); // A státusz New-ról Draft-ra válthat
    } catch (err) {
      alert('Hiba az alkatrész hozzáadásakor!');
    }
  };

  const handleUpdateQty = async (itemId, currentQty) => {
    const newQty = prompt('Új mennyiség:', currentQty);
    if (!newQty || isNaN(newQty) || newQty <= 0) return;
    try {
      await axios.patch(
        `http://localhost:8000/expert/project-parts/${itemId}`,
        { quantity: parseInt(newQty) },
        { headers }
      );
      fetchProjectParts(selectedProject.id);
    } catch (err) {
      alert('Hiba a módosításkor!');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Biztosan törlöd ezt az alkatrészt a projektből?'))
      return;
    try {
      await axios.delete(
        `http://localhost:8000/expert/project-parts/${itemId}`,
        { headers }
      );
      fetchProjectParts(selectedProject.id);
    } catch (err) {
      alert('Hiba a törléskor!');
    }
  };

  // --- Kalkulációk ---
  const partsTotal = projectParts.reduce(
    (s, i) => s + i.price * i.required_quantity,
    0
  );
  const laborTotal = (calc.hours || 0) * (calc.hourlyRate || 0);
  const grandTotal = partsTotal + laborTotal;

  // --- Státuszkezelés ---
  const handleOrder = async () => {
    if (calc.hours <= 0 || calc.hourlyRate <= 0)
      return alert('Kérjük, adja meg a munkaórát és az óradíjat!');
    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/finalize`,
        { estimated_hours: calc.hours, total_price: grandTotal },
        { headers }
      );
      alert('Igény beküldve a raktárnak!');
      fetchProjects();
    } catch (err) {
      alert('Hiba a beküldéskor!');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (
      !window.confirm(`Biztosan módosítod a projekt állapotát: ${newStatus}?`)
    )
      return;
    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/status`,
        { status: newStatus },
        { headers }
      );
      alert(`Projekt állapota: ${newStatus}`);
      fetchProjects();
    } catch (err) {
      alert('Hiba a státuszváltáskor!');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // --- Gomb engedélyezések ---
  const canSubmitOrder = ['New', 'Draft', 'Wait'].includes(
    selectedProject?.status
  );
  const canGeneratePDF = selectedProject?.status === 'Scheduled';
  const canFinalize = ['Scheduled', 'InProgress'].includes(
    selectedProject?.status
  );

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Projektek</h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className={styles.addBtn}
          >
            + Új
          </button>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            🚪
          </button>
        </div>
        <div className={styles.projectList}>
          {projects.map((p) => (
            <div
              key={p.id}
              className={`${styles.projectItem} ${
                selectedProject?.id === p.id ? styles.active : ''
              }`}
              onClick={() => setSelectedProject(p)}
            >
              <strong>{p.location}</strong>
              <small>{p.status}</small>
            </div>
          ))}
        </div>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={fetchProjects}
      />

      <div className={styles.mainContent}>
        {selectedProject ? (
          <div className={styles.details}>
            <header className={styles.header}>
              <h2>{selectedProject.location}</h2>
              <span className={styles.statusBadge}>
                {selectedProject.status}
              </span>
            </header>

            <PartSelector parts={parts} onAdd={handleAddPart} />

            <ProjectPartsList
              projectParts={projectParts}
              onUpdate={handleUpdateQty}
              onDelete={handleDeleteItem}
            />

            <div className={styles.summarySection}>
              <h4>Anyagköltség: {partsTotal.toLocaleString()} Ft</h4>
              <div className={styles.inputRow}>
                <input
                  type='number'
                  placeholder='Munkaórák'
                  value={calc.hours || ''}
                  onChange={(e) =>
                    setCalc({ ...calc, hours: parseInt(e.target.value) || 0 })
                  }
                />
                <input
                  type='number'
                  placeholder='Óradíj (Ft)'
                  value={calc.hourlyRate || ''}
                  onChange={(e) =>
                    setCalc({
                      ...calc,
                      hourlyRate: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <h3>Összesen: {grandTotal.toLocaleString()} Ft</h3>
            </div>

            <div className={styles.buttonGroup}>
              {canSubmitOrder && (
                <button onClick={handleOrder} className={styles.orderBtn}>
                  🚀 IGÉNY BEKÜLDÉSE
                </button>
              )}

              <button
                disabled={!canGeneratePDF}
                onClick={() =>
                  generateProjectPDF(selectedProject, projectParts, calc, {
                    partsTotal,
                    laborTotal,
                    grandTotal,
                  })
                }
                className={
                  canGeneratePDF ? styles.pdfBtnActive : styles.pdfBtnDisabled
                }
              >
                📄 ÁRKALKULÁCIÓ (PDF)
              </button>

              {canFinalize && (
                <div className={styles.finalActions}>
                  <button
                    onClick={() => handleStatusUpdate('Completed')}
                    className={styles.completeBtn}
                  >
                    ✅ KÉSZ
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('Failed')}
                    className={styles.failBtn}
                  >
                    ❌ HIBA
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            Válasszon egy projektet a listából!
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertDashboard;
