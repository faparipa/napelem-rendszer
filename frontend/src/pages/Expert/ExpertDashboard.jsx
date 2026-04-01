// import { useState, useEffect } from 'react';
// import axios from 'axios';
// import styles from './ExpertDashboard.module.css';
// import { generateProjectPDF } from './exportUtils';
// import PartSelector from './PartSelector';
// import ProjectPartsList from './ProjectPartsList';

// const ExpertDashboard = () => {
//   const [projects, setProjects] = useState([]);
//   const [parts, setParts] = useState([]);
//   const [projectParts, setProjectParts] = useState([]);
//   const [selectedProject, setSelectedProject] = useState(null);
//   const [calc, setCalc] = useState({ hours: 0, hourlyRate: 0 });
//   const canGeneratePDF = selectedProject?.status === 'Scheduled';
//   const canSubmitOrder = ['New', 'Draft', 'Wait'].includes(
//     selectedProject?.status
//   );

//   const token = localStorage.getItem('token');
//   const headers = { Authorization: `Bearer ${token}` };

//   useEffect(() => {
//     fetchProjects();
//     fetchParts();
//   }, []);

//   useEffect(() => {
//     if (selectedProject) fetchProjectParts(selectedProject.id);
//   }, [selectedProject]);

//   const fetchProjects = async () => {
//     try {
//       const res = await axios.get('http://localhost:8000/expert/projects', {
//         headers,
//       });
//       setProjects(res.data);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const fetchParts = async () => {
//     try {
//       const res = await axios.get(
//         'http://localhost:8000/expert/parts-with-stock',
//         { headers }
//       );
//       setParts(res.data);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const fetchProjectParts = async (id) => {
//     try {
//       const res = await axios.get(
//         `http://localhost:8000/expert/projects/${id}/parts`,
//         { headers }
//       );
//       setProjectParts(res.data);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const handleAddPart = async (partId, qty) => {
//     if (!qty || qty <= 0) return alert('Mennyiség?');
//     try {
//       await axios.post(
//         `http://localhost:8000/expert/projects/${selectedProject.id}/parts`,
//         { part_id: partId, quantity: qty },
//         { headers }
//       );
//       fetchProjectParts(selectedProject.id);
//     } catch (err) {
//       alert('Hiba!');
//     }
//   };

//   const handleUpdateQty = async (itemId, currentQty) => {
//     const newQty = prompt('Új mennyiség:', currentQty);
//     if (!newQty || isNaN(newQty) || newQty <= 0) return;
//     try {
//       await axios.patch(
//         `http://localhost:8000/expert/project-parts/${itemId}`,
//         { quantity: parseInt(newQty) },
//         { headers }
//       );
//       fetchProjectParts(selectedProject.id);
//     } catch (err) {
//       alert('Hiba!');
//     }
//   };

//   const handleDeleteItem = async (itemId) => {
//     if (!window.confirm('Biztosan törlöd?')) return;
//     try {
//       await axios.delete(
//         `http://localhost:8000/expert/project-parts/${itemId}`,
//         { headers }
//       );
//       fetchProjectParts(selectedProject.id);
//     } catch (err) {
//       alert('Hiba!');
//     }
//   };

//   // SZÁMÍTÁSOK
//   const partsTotal = projectParts.reduce(
//     (s, i) => s + i.price * i.required_quantity,
//     0
//   );
//   const laborTotal = calc.hours * calc.hourlyRate;
//   const grandTotal = partsTotal + laborTotal;

//   const handleOrder = async () => {
//     if (calc.hours <= 0 || calc.hourlyRate <= 0)
//       return alert(
//         'Megfelelően töltse ki a munkadíj meghatározásához a mezőket?'
//       );
//     try {
//       const pPrice = projectParts.reduce(
//         (s, i) => s + i.price * i.required_quantity,
//         0
//       );
//       await axios.put(
//         `http://localhost:8000/expert/projects/${selectedProject.id}/finalize`,
//         {
//           estimated_hours: calc.hours,
//           total_price: calc.hours * calc.hourlyRate + pPrice,
//         },
//         { headers }
//       );
//       alert('Sikeres megrendelés!');
//       setSelectedProject(null);
//       fetchProjects();
//     } catch (err) {
//       alert('Hiba!');
//     }
//   };

//   const handlePDF = () => {
//     generateProjectPDF(selectedProject, projectParts, calc, {
//       partsTotal,
//       laborTotal,
//       grandTotal,
//     });
//   };

//   return (
//     <div className={styles.container}>
//       <div className={styles.sidebar}>
//         <h3>Projektek</h3>
//         {projects.map((p) => (
//           <div
//             key={p.id}
//             className={`${styles.projectItem} ${
//               selectedProject?.id === p.id ? styles.active : ''
//             }`}
//             onClick={() => setSelectedProject(p)}
//           >
//             {p.location} ({p.status})
//           </div>
//         ))}
//       </div>

//       <div className={styles.mainContent}>
//         {selectedProject ? (
//           <div className={styles.details}>
//             <h2>{selectedProject.location}</h2>

//             <PartSelector parts={parts} onAdd={handleAddPart} />

//             <hr />

//             <ProjectPartsList
//               projectParts={projectParts}
//               onUpdate={handleUpdateQty}
//               onDelete={handleDeleteItem}
//             />
//             <h4>Anyagköltség összesen: {partsTotal.toLocaleString()} Ft</h4>
//             <section className={styles.orderBox}>
//               <div className={styles.inputRow}>
//                 <input
//                   type='number'
//                   placeholder='Munkaórák'
//                   required
//                   onChange={(e) =>
//                     setCalc({ ...calc, hours: parseInt(e.target.value) || 0 })
//                   }
//                 />
//                 <input
//                   type='number'
//                   placeholder='Óradíj (Ft)'
//                   required
//                   onChange={(e) =>
//                     setCalc({
//                       ...calc,
//                       hourlyRate: parseInt(e.target.value) || 0,
//                     })
//                   }
//                 />
//               </div>
//               <h4>Munkadíj öszzesen: {laborTotal.toLocaleString()} Ft</h4>
//               <h3>Összesen: {grandTotal.toLocaleString()} Ft</h3>

//               <div className={styles.buttonGroup}>
//                 <button
//                   disabled={!canSubmitOrder}
//                   onClick={handleOrder}
//                   className={styles.orderBtn}
//                 >
//                   🚀 MEGRENDELÉS BEKÜLDÉSE
//                 </button>
//                 <div className={styles.statusInfo}>
//                   {selectedProject.status === 'Wait' && (
//                     <p className={styles.warningText}>
//                       ⚠️ Várjon a raktár válaszára!
//                     </p>
//                   )}
//                   {selectedProject.status === 'Scheduled' && (
//                     <p className={styles.successText}>
//                       ✅ Alkatrészek kigyűjtve, az ár fixálva. Generálhatja a
//                       PDF-et.
//                     </p>
//                   )}
//                 </div>
//                 <button
//                   disabled={!canGeneratePDF}
//                   onClick={handlePDF}
//                   className={
//                     canGeneratePDF ? styles.pdfBtnActive : styles.pdfBtnDisabled
//                   }
//                 >
//                   📄 Árkalkuláció elkészítése (PDF)
//                 </button>
//               </div>
//             </section>
//           </div>
//         ) : (
//           'Válassz projektet!'
//         )}
//       </div>
//     </div>
//   );
// };

// export default ExpertDashboard;

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import styles from './ExpertDashboard.module.css';
import { generateProjectPDF } from './exportUtils';
import PartSelector from './PartSelector';
import ProjectPartsList from './ProjectPartsList';

const ExpertDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [parts, setParts] = useState([]);
  const [projectParts, setProjectParts] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [calc, setCalc] = useState({ hours: 0, hourlyRate: 0 });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  // Kijelentkezés funkció
  const handleLogout = () => {
    localStorage.removeItem('token'); // Token törlése
    localStorage.removeItem('role'); // Ha mentettél szerepkört, azt is
    navigate('/login'); // Vissza a belépéshez
  };

  // Dinamikus gomb-státuszok
  const canGeneratePDF = useMemo(
    () => selectedProject?.status === 'Scheduled',
    [selectedProject]
  );
  const canSubmitOrder = useMemo(
    () => ['New', 'Draft', 'Wait'].includes(selectedProject?.status),
    [selectedProject]
  );

  useEffect(() => {
    fetchProjects();
    fetchParts();
  }, []);

  useEffect(() => {
    if (selectedProject) fetchProjectParts(selectedProject.id);
  }, [selectedProject]);

  const fetchProjects = async () => {
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
      console.error(err);
    }
  };

  const fetchParts = async () => {
    try {
      const res = await axios.get(
        'http://localhost:8000/expert/parts-with-stock',
        { headers }
      );
      setParts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectParts = async (id) => {
    try {
      const res = await axios.get(
        `http://localhost:8000/expert/projects/${id}/parts`,
        { headers }
      );
      setProjectParts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const partsTotal = projectParts.reduce(
    (s, i) => s + i.price * i.required_quantity,
    0
  );
  const laborTotal = (calc.hours || 0) * (calc.hourlyRate || 0);
  const grandTotal = partsTotal + laborTotal;

  const handleOrder = async () => {
    if (calc.hours <= 0 || calc.hourlyRate <= 0)
      return alert(
        'Kérjük, adja meg a munkaórát és az óradíjat a beküldés előtt!'
      );
    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/finalize`,
        { estimated_hours: calc.hours, total_price: grandTotal },
        { headers }
      );
      alert('Igény beküldve a raktárnak! Várjon a visszaigazolásra.');
      fetchProjects();
    } catch (err) {
      alert('Hiba a beküldéskor!');
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Biztosan készre jelenti a projektet?')) return;
    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/status`,
        { status: 'Completed' },
        { headers }
      );
      alert('Gratulálunk! A projekt sikeresen lezárult.');
      fetchProjects();
    } catch (err) {
      alert('Hiba a lezárás során!');
    }
  };

  const handleFail = async () => {
    const reason = prompt(
      'Miért hiúsult meg a projekt? (Pl. Megrendelő elállt tőle)'
    );
    if (reason === null) return; // Mégse gomb a promptnál

    try {
      await axios.put(
        `http://localhost:8000/expert/projects/${selectedProject.id}/status`,
        { status: 'Failed', note: reason },
        { headers }
      );
      alert('A projekt meghiúsultként lett rögzítve.');
      fetchProjects();
    } catch (err) {
      alert('Hiba a státusz módosításakor!');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Projektek</h3>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            🚪 Kijelentkezés
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
              <br />
              <small>Státusz: {p.status}</small>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.mainContent}>
        {selectedProject ? (
          <div className={styles.details}>
            <h2>{selectedProject.location}</h2>
            <PartSelector
              parts={parts}
              onAdd={(id, qty) => {
                /* axios post... */ fetchProjectParts(selectedProject.id);
              }}
            />
            <hr />
            <ProjectPartsList
              projectParts={projectParts}
              onUpdate={() => fetchProjectParts(selectedProject.id)}
              onDelete={() => fetchProjectParts(selectedProject.id)}
            />

            <div className={styles.summarySection}>
              <h4>Anyagköltség: {partsTotal.toLocaleString()} Ft</h4>
              <div className={styles.inputRow}>
                <input
                  type='number'
                  placeholder='Órák'
                  onChange={(e) =>
                    setCalc({ ...calc, hours: parseInt(e.target.value) || 0 })
                  }
                />
                <input
                  type='number'
                  placeholder='Óradíj'
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
              {/* 1. Megrendelés beküldése (Elején) */}
              {canSubmitOrder && (
                <button onClick={handleOrder} className={styles.orderBtn}>
                  🚀 IGÉNY BEKÜLDÉSE A RAKTÁRNAK
                </button>
              )}

              {/* 2. PDF Generálás (Csak Scheduled) */}
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
                📄 Árkalkuláció (PDF)
              </button>

              {/* --- ÚJ LEZÁRÓ GOMBOK --- */}
              {['Scheduled', 'InProgress'].includes(selectedProject.status) && (
                <div className={styles.finalActions}>
                  <button
                    onClick={handleComplete}
                    className={styles.completeBtn}
                  >
                    ✅ SIKERESEN ELKÉSZÜLT
                  </button>

                  <button onClick={handleFail} className={styles.failBtn}>
                    ❌ PROJEKT MEGHIÚSULT
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          'Válassz projektet!'
        )}
      </div>
    </div>
  );
};

export default ExpertDashboard;
