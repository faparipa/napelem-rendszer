// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import styles from './ProjectRequirements.module.css';

// const ProjectRequirements = ({ onSelect, selectedId }) => {
//   const [requirements, setRequirements] = useState([]);

//   const fetchData = async () => {
//     try {
//       const token = localStorage.getItem('token');
//       const res = await axios.get(
//         'http://localhost:8000/warehouse/reports/project-requirements',
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setRequirements(res.data);
//     } catch (err) {
//       console.error('Hiba az igények lekérésekor:', err);
//     }
//   };

//   useEffect(() => {
//     fetchData();
//     const interval = setInterval(fetchData, 30000);
//     return () => clearInterval(interval);
//   }, []);

//   const grouped = requirements.reduce((acc, item) => {
//     if (!acc[item.project_id]) {
//       acc[item.project_id] = {
//         project_id: item.project_id,
//         location: item.location,
//         parts: [],
//       };
//     }
//     acc[item.project_id].parts.push({ name: item.part_name, qty: item.qty });
//     return acc;
//   }, {});

//   return (
//     <div className={styles.container}>
//       <h3 className={styles.title}>📋 Projektigények Listája</h3>

//       {Object.keys(grouped).length === 0 ? (
//         <p className={styles.empty}>Nincs aktív projektigény.</p>
//       ) : (
//         Object.values(grouped).map((project) => (
//           <div
//             key={project.project_id}
//             className={`${styles.projectCard} ${
//               selectedId === project.project_id ? styles.activeCard : ''
//             }`}
//             onClick={() => onSelect && onSelect(project.project_id)}
//             style={{ cursor: 'pointer' }}
//           >
//             <span className={styles.projectHeader}>
//               ID: {project.project_id} — {project.location}
//             </span>
//             <div className={styles.partsList}>
//               {project.parts.map((p, idx) => (
//                 <div key={idx} className={styles.partBadge}>
//                   {p.name}: <span className={styles.partQty}>{p.qty} db</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         ))
//       )}
//     </div>
//   );
// };

// export default ProjectRequirements;
import React, { useEffect } from 'react';
import styles from './ProjectRequirements.module.css';
import useWorkerStore from '../pages/store/useWorkerStore';

const ProjectRequirements = ({ onSelect, selectedId }) => {
  const { projects, loadProjects } = useWorkerStore();

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 30000);
    return () => clearInterval(interval);
  }, [loadProjects]);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>📋 Projektigények Listája</h3>

      {projects.length === 0 ? (
        <p className={styles.empty}>Nincs aktív projektigény.</p>
      ) : (
        projects.map((project) => (
          <div
            key={project.id}
            className={`${styles.projectCard} ${
              selectedId === project.id ? styles.activeCard : ''
            }`}
            onClick={() => onSelect && onSelect(project.id)}
            style={{ cursor: 'pointer' }}
          >
            <span className={styles.projectHeader}>
              ID: {project.id} — {project.location}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default ProjectRequirements;
