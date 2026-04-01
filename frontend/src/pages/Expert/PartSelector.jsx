import styles from './ExpertDashboard.module.css';

const PartSelector = ({ parts, onAdd }) => (
  <div className={styles.section}>
    <h3>Alkatrészek válogatása</h3>
    <table className={styles.partTable}>
      <tbody>
        {parts.map((p) => (
          <tr key={p.id}>
            <td>
              {p.name} ({p.stock} db)
            </td>
            <td>
              <input
                type='number'
                id={`qty-${p.id}`}
                defaultValue='1'
                min='1'
                className={styles.qtyInput}
              />
            </td>
            <td>
              <button
                onClick={() => {
                  const qty = parseInt(
                    document.getElementById(`qty-${p.id}`).value
                  );
                  onAdd(p.id, qty);
                }}
              >
                +
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default PartSelector;
