// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import styles from './ProjectTimeline.module.css';

// const ProjectTimeline = ({ projectId }) => {
//   const [logs, setLogs] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchLogs = async () => {
//       if (!projectId) return;
//       try {
//         const res = await axios.get(
//           `http://localhost:8000/expert/projects/${projectId}/logs`,
//           {
//             headers: {
//               Authorization: `Bearer ${localStorage.getItem('token')}`,
//             },
//           }
//         );
//         setLogs(res.data);
//       } catch (err) {
//         console.error('Hiba a napló lekérésekor:', err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchLogs();
//   }, [projectId]);

//   if (loading) return <p>Napló töltése...</p>;
//   if (logs.length === 0)
//     return <p>Nincs még rögzített esemény ehhez a projekthez.</p>;

//   return (
//     <div className={styles.timelineContainer}>
//       <h3>📋 Projekt Életút Napló</h3>
//       <div className={styles.timelineList}>
//         {logs.map((log) => (
//           <div key={log.id} className={styles.timelineItem}>
//             <div className={styles.timeBadge}>
//               {new Date(log.timestamp).toLocaleString('hu-HU')}
//             </div>
//             <div className={styles.statusContent}>
//               <span className={`${styles.statusLabel} ${styles[log.status]}`}>
//                 {log.status}
//               </span>
//               {/* Itt jelenítjük meg a felhasználót */}
//               <p className={styles.userNote}>
//                 Módosította: <strong>{log.user_name}</strong>
//               </p>
//               <p className={styles.message}>
//                 {log.message || 'Állapotváltozás történt.'}
//               </p>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// };

// export default ProjectTimeline;
import React, { useEffect } from 'react';
import styles from './ProjectTimeline.module.css';
import useWorkerStore from '../pages/store/useWorkerStore';

const ProjectTimeline = ({ projectId }) => {
  const { timelineLogs, loadingLogs, fetchProjectLogs } = useWorkerStore();

  useEffect(() => {
    fetchProjectLogs(projectId);
  }, [projectId, fetchProjectLogs]);

  if (loadingLogs) return <p>Napló töltése...</p>;
  if (!projectId)
    return <p>Válassz ki egy projektet a napló megtekintéséhez.</p>;
  if (timelineLogs.length === 0)
    return <p>Nincs még rögzített esemény ehhez a projekthez.</p>;

  return (
    <div className={styles.timelineContainer}>
      <h3>📋 Projekt Életút Napló</h3>
      <div className={styles.timelineList}>
        {timelineLogs.map((log) => (
          <div key={log.id} className={styles.timelineItem}>
            <div className={styles.timeBadge}>
              {new Date(log.timestamp).toLocaleString('hu-HU')}
            </div>
            <div className={styles.statusContent}>
              <span className={`${styles.statusLabel} ${styles[log.status]}`}>
                {log.status}
              </span>
              <p className={styles.userNote}>
                Módosította: <strong>{log.user_name}</strong>
              </p>
              <p className={styles.message}>
                {log.message || 'Állapotváltozás történt.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectTimeline;
