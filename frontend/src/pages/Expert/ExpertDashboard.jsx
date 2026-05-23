import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ExpertDashboard.module.css';
import { generateProjectPDF } from './exportUtils';
import PartSelector from './PartSelector';
import ProjectPartsList from './ProjectPartsList';
import CreateProjectModal from './CreateProjectModal';
import LogoutButton from '../../components/LogoutButton';
import ProjectTimeline from '../../components/ProjectTimeline';
import useProjectStore from '../store/useProjectStore';

const ExpertDashboard = () => {
  const navigate = useNavigate();
  const {
    projects,
    parts,
    projectParts,
    selectedProject,
    fetchAllData,
    setSelectedProject,
    addPart,
    updatePartQty,
    deletePart,
    finalizeProject,
    updateStatus,
  } = useProjectStore();

  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [isEditingCalc, setIsEditingCalc] = useState(false);
  const [calc, setCalc] = useState({ hours: 0, hourlyRate: 0 });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchAllData();
    }
  }, [token, navigate, fetchAllData]);

  useEffect(() => {
    if (selectedProject) {
      const hours = selectedProject.estimated_time || 0;
      const price = selectedProject.price || 0;
      if (hours > 0) {
        setCalc({ hours, hourlyRate: Math.round(price / hours) });
        setIsEditingCalc(false);
      } else {
        setCalc({ hours: 0, hourlyRate: 0 });
        setIsEditingCalc(true);
      }
    }
  }, [selectedProject]);

  if (!token) return null;

  const filteredProjects = useMemo(
    () =>
      statusFilter === 'All'
        ? projects
        : projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter]
  );

  const isEditable =
    selectedProject &&
    ['New', 'Draft', 'Wait', 'InProgress', 'Completed'].includes(
      selectedProject.status
    );

  const canGeneratePDF = ['Scheduled', 'InProgress', 'Completed'].includes(
    selectedProject?.status
  );

  const isCalculationValid =
    projectParts.length > 0 && calc.hours > 0 && calc.hourlyRate > 0;

  const partsTotal = projectParts.reduce(
    (s, i) => s + i.price * i.required_quantity,
    0
  );
  const laborTotal = calc.hours * calc.hourlyRate;

  const handleSaveCalc = async () => {
    if (calc.hours <= 0 || calc.hourlyRate <= 0)
      return alert('Érvénytelen adatok!');
    setIsEditingCalc(false);
    alert('Kalkuláció rögzítve!');
  };

  const onUpdateStatus = async (status) => {
    if (window.confirm(`Módosítod a státuszt: ${status}?`)) {
      await updateStatus(status);
    }
  };

  // Csak akkor lehessen beküldeni, ha még nem lett véglegesítve (szerkeszthető státuszban van)
  const canFinalize = useMemo(() => {
    return selectedProject && ['New', 'Draft'].includes(selectedProject.status);
  }, [selectedProject?.status]);

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <h2>👷 Szakember Munkalap</h2>
        <LogoutButton />
      </nav>

      <div className={styles.dashboardGrid}>
        {/* SIDEBAR */}
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.statusSelect}
              >
                <option value='All'>Összes projekt</option>
                <option value='New'>New (Új)</option>
                <option value='Draft'>Draft (Vázlat)</option>
                <option value='Wait'>Wait (Vár)</option>
                <option value='Scheduled'>'Scheduled'</option>
                <option value='InProgress'>InProgress</option>
                <option value='Completed'>Completed</option>
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

        {/* FŐ TARTALOM */}
        <div className={styles.mainContent}>
          {selectedProject ? (
            <div className={styles.details}>
              <header className={styles.header}>
                <h2>{selectedProject.location}</h2>
                <span className={styles.statusBadge}>
                  {selectedProject.status}
                </span>
              </header>

              {isEditable && <PartSelector parts={parts} onAdd={addPart} />}

              <ProjectPartsList
                projectParts={projectParts}
                onUpdate={(id, qty) => {
                  const newQty = prompt('Új mennyiség:', qty);
                  if (newQty) updatePartQty(id, newQty);
                }}
                onDelete={(id) => window.confirm('Törlöd?') && deletePart(id)}
                canSubmitOrder={isEditable}
              />

              <div className={styles.summarySection}>
                <h4>Anyagköltség: {partsTotal.toLocaleString()} Ft</h4>

                {isEditingCalc ? (
                  <div className={styles.inputRow}>
                    <input
                      type='number'
                      placeholder='Óra'
                      value={calc.hours || ''}
                      onChange={(e) =>
                        setCalc({
                          ...calc,
                          hours: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <input
                      type='number'
                      placeholder='Óradíj'
                      value={calc.hourlyRate || ''}
                      onChange={(e) =>
                        setCalc({
                          ...calc,
                          hourlyRate: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <button onClick={handleSaveCalc} className={styles.editBtn}>
                      Rögzít
                    </button>
                  </div>
                ) : (
                  <div className={styles.savedCalc}>
                    <p>
                      Munkadíj: {laborTotal.toLocaleString()} Ft ({calc.hours}{' '}
                      óra)
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

                {isEditable && (
                  <button
                    onClick={() => finalizeProject(calc.hours, laborTotal)}
                    className={`${styles.orderBtn} ${
                      !canFinalize || !isCalculationValid
                        ? styles.disabledBtn
                        : ''
                    }`}
                    disabled={!canFinalize || !isCalculationValid}
                  >
                    📝 Kalkuláció véglegesítése (Készlet ellenőrzéssel)
                  </button>
                )}
              </div>

              <div className={styles.buttonGroup}>
                <button
                  disabled={!canGeneratePDF}
                  onClick={() =>
                    generateProjectPDF(selectedProject, projectParts, calc, {
                      partsTotal,
                      laborTotal,
                    })
                  }
                  className={
                    canGeneratePDF ? styles.pdfBtnActive : styles.pdfBtnDisabled
                  }
                >
                  📄 PDF
                </button>

                {['New', 'Draft', 'Wait', 'InProgress', 'Scheduled'].includes(
                  selectedProject?.status
                ) && (
                  <div className={styles.finalActions}>
                    {selectedProject?.status === 'InProgress' && (
                      <button
                        onClick={() => onUpdateStatus('Completed')}
                        className={styles.completeBtn}
                      >
                        ✅ KÉSZ
                      </button>
                    )}
                    <button
                      onClick={() => onUpdateStatus('Failed')}
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
                  {showLog ? '🔼 Elrejt' : '📜 Napló'}
                </button>
                {showLog && <ProjectTimeline projectId={selectedProject.id} />}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>Válasszon projektet!</div>
          )}
        </div>
      </div>
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={fetchAllData}
      />
    </div>
  );
};

export default ExpertDashboard;
