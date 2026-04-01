import styles from './ExpertDashboard.module.css';

const ProjectPartsList = ({ projectParts, onUpdate, onDelete }) => (
  <div className={styles.section}>
    <h3>Rendelt tételek módosítása</h3>
    <table className={styles.partTable}>
      <thead>
        <tr>
          <th>Név</th>
          <th>Mennyiség</th>
          <th>Ár</th>
          <th>Műveletek</th>
        </tr>
      </thead>
      <tbody>
        {projectParts.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>
              <strong>{item.required_quantity} db</strong>
            </td>
            <td>{item.price * item.required_quantity} Ft</td>
            <td>
              <button
                onClick={() => onUpdate(item.id, item.required_quantity)}
                className={styles.editBtn}
              >
                ✏️
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className={styles.deleteBtn}
              >
                🗑️
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ProjectPartsList;
