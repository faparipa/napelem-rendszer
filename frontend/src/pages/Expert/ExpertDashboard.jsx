import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import styles from './ExpertDashboard.module.css';
import { generateProjectPDF } from './exportUtils';
import PartSelector from './PartSelector';
import ProjectPartsList from './ProjectPartsList';
import { useNavigate } from 'react-router-dom';
import CreateProjectModal from './CreateProjectModal';
import LogoutButton from '../../components/LogoutButton';
import ProjectTimeline from '../../components/ProjectTimeline';

const ExpertDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [parts, setParts] = useState([]);
  const [projectParts, setProjectParts] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [calc, setCalc] = useState({ hours: 0, hourlyRate: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const [isEditingCalc, setIsEditingCalc] = useState(true);

  const [statusFilter, setStatusFilter] = useState('All');
  const [showLog, setShowLog] = useState(false);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'All') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);
  // --- JOGOSULTSÁGOK ÉS STÁTUSZ LOGIKA ---

  // Szerkeszthető: Csak ha még nincs a raktárosnál feldolgozás alatt
  const isEditable =
    selectedProject &&
    ['New', 'Draft', 'Wait'].includes(selectedProject.status);

  // Beküldhető: Csak az alapállapotokban
  const canSubmitOrder = isEditable;

  // PDF és Befejezés: Csak ha már a raktáros jóváhagyta és InProgress
  const canGeneratePDF =
    selectedProject?.status === 'InProgress' ||
    selectedProject?.status === 'Completed';
  const canFinalize = selectedProject?.status === 'InProgress';

  const token = localStorage.getItem('token');
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:8000/expert/projects', {
        headers,
      });
      setProjects(res.data);
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
  }, [token, navigate, fetchParts]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectParts(selectedProject.id);

      const savedHours = selectedProject.estimated_time || 0;
      const savedTotalPrice = selectedProject.price || 0;

      if (savedHours > 0) {
        const calculatedRate = Math.round(savedTotalPrice / savedHours);
        setCalc({
          hours: savedHours,
          hourlyRate: calculatedRate,
        });
        setIsEditingCalc(false);
      } else {
        setCalc({ hours: 0, hourlyRate: 0 });
        setIsEditingCalc(true);
      }
    }
  }, [selectedProject, fetchProjectParts]);

  // --- MŰVELETEK VÉDELEMMEL ---

  const handleAddPart = async (partId, qty) => {
    if (!isEditable)
      return alert('A projekt állapota miatt már nem adható hozzá alkatrész!');
    if (!qty || qty <= 0)
      return alert('Kérlek adj meg egy érvényes mennyiséget!');
    try {
      await axios.post(
        `http://localhost:8000/expert/projects/${selectedProject.id}/parts`,
        { part_id: partId, quantity: parseInt(qty) },
        { headers }
      );
      fetchProjectParts(selectedProject.id);
      fetchProjects();
    } catch (err) {
      alert('Hiba az alkatrész hozzáadásakor!');
    }
  };

  const handleUpdateQty = async (itemId, currentQty) => {
    if (!isEditable) return alert('A projekt már nem módosítható!');
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
    if (!isEditable) return alert('A projekt már nem módosítható!');
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

  const handleSaveCalc = async () => {
    if (!isEditable) return alert('A kalkuláció már nem módosítható!');
    if (calc.hours <= 0 || calc.hourlyRate <= 0) {
      return alert('Kérlek adj meg érvényes órát és óradíjat!');
    }

    const totalLaborFee = calc.hours * calc.hourlyRate;

    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/finalize`,
        {
          estimated_time: calc.hours,
          price: totalLaborFee,
        },
        { headers }
      );

      await fetchProjects();
      setIsEditingCalc(false);
      alert('Kalkuláció rögzítve!');
    } catch (err) {
      console.error('Hiba a rögzítéskor:', err);
      alert('Nem sikerült rögzíteni az adatokat.');
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

  const handleOrder = async () => {
    if (!canSubmitOrder) return;
    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/finalize`,
        { estimated_time: calc.hours, price: calc.hours * calc.hourlyRate },
        { headers }
      );
      alert('Beküldve a raktárnak!');
      fetchProjects();
    } catch (err) {
      alert('Hiba a beküldés során!');
    }
  };

  const partsTotal = projectParts.reduce(
    (s, i) => s + i.price * i.required_quantity,
    0
  );
  const laborTotal = (calc.hours || 0) * (calc.hourlyRate || 0);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <h2>👷 Szakember Munkalap</h2>
        <LogoutButton />
      </nav>
      <div className={styles.dashboardGrid}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Projektek</h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className={styles.addBtn}
            >
              + Új Project
            </button>
            <div className={styles.filterSection}>
              <label htmlFor='statusFilter'>Szűrés állapotra:</label>
              <select
                id='statusFilter'
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.statusSelect}
              >
                <option value='All'>Összes projekt</option>
                <option value='New'>New (Új)</option>
                <option value='Draft'>Draft (Vázlat)</option>
                <option value='Wait'>Wait (Raktárra vár)</option>
                <option value='Scheduled'>Scheduled (Ütemezve)</option>
                <option value='InProgress'>InProgress (Folyamatban)</option>
                <option value='Completed'>Completed (Kész)</option>
                <option value='Failed'>Failed (Hiba)</option>
              </select>
            </div>
          </div>
          <div className={styles.projectList}>
            {filteredProjects.map((p) => (
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

              {/* Alkatrész választó elrejtése ha nem szerkeszthető */}
              {isEditable && (
                <PartSelector parts={parts} onAdd={handleAddPart} />
              )}

              <ProjectPartsList
                projectParts={projectParts}
                onUpdate={handleUpdateQty}
                onDelete={handleDeleteItem}
                canSubmitOrder={isEditable}
              />

              <div className={styles.summarySection}>
                <h4>Anyagköltség: {partsTotal.toLocaleString()} Ft</h4>

                {isEditingCalc ? (
                  <div className={styles.inputRow}>
                    <input
                      type='number'
                      placeholder='Munkaórák'
                      value={calc.hours || ''}
                      onChange={(e) =>
                        setCalc({
                          ...calc,
                          hours: parseInt(e.target.value) || 0,
                        })
                      }
                      disabled={!isEditable}
                    />
                    <input
                      type='number'
                      placeholder='Szakember óradíja (Ft)'
                      value={calc.hourlyRate || ''}
                      onChange={(e) =>
                        setCalc({
                          ...calc,
                          hourlyRate: parseInt(e.target.value) || 0,
                        })
                      }
                      disabled={!isEditable}
                    />
                    <button
                      onClick={handleSaveCalc}
                      className={styles.editBtn}
                      disabled={!isEditable}
                    >
                      Rögzít
                    </button>
                  </div>
                ) : (
                  <div className={styles.savedCalc}>
                    <p>
                      Munkaidő: {calc.hours} óra | Óradíj:{' '}
                      {calc.hourlyRate.toLocaleString()} Ft/óra |{' '}
                      <strong>
                        Munkadíj: {laborTotal.toLocaleString()} Ft
                      </strong>
                    </p>
                    {isEditable && (
                      <button
                        onClick={() => setIsEditingCalc(true)}
                        className={styles.editBtn}
                      >
                        Módosítás
                      </button>
                    )}
                  </div>
                )}

                <hr />
                <h3>
                  Végösszeg: {(partsTotal + laborTotal).toLocaleString()} Ft
                </h3>

                <button
                  onClick={handleOrder}
                  className={styles.orderBtn}
                  disabled={!canSubmitOrder}
                  style={
                    !canSubmitOrder
                      ? { backgroundColor: '#94a3b8', cursor: 'not-allowed' }
                      : {}
                  }
                >
                  {selectedProject?.status === 'InProgress'
                    ? '🛠️ RAKTÁROZÁS ALATT (ZÁROLT)'
                    : selectedProject?.status === 'Completed'
                    ? '✅ PROJEKT KÉSZ'
                    : '🚀 KALKULÁCIÓ VÉGLEGESÍTÉSE ÉS BEKÜLDÉSE'}
                </button>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  disabled={!canGeneratePDF}
                  onClick={() =>
                    generateProjectPDF(selectedProject, projectParts, calc, {
                      partsTotal,
                      laborTotal,
                      grandTotal: partsTotal + laborTotal,
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
              <div className={styles.logSection}>
                <button
                  onClick={() => setShowLog(!showLog)}
                  className={styles.toggleLogBtn}
                >
                  {showLog
                    ? '🔼 Napló elrejtése'
                    : '📜 Projekt életút (Napló) megtekintése'}
                </button>

                {showLog && (
                  <div className={styles.logContainer}>
                    <ProjectTimeline projectId={selectedProject.id} />
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
    </div>
  );
};

export default ExpertDashboard;
