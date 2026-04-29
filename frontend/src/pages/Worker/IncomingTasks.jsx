// IncomingTasks.jsx
const IncomingTasks = () => {
  const [tasks, setTasks] = useState([]); // Beérkező áruk listája

  return (
    <div className={styles.container}>
      <h3>📥 Bevételezési Feladatok</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Alkatrész</th>
            <th>Mennyiség</th>
            <th>Javasolt hely (Rekesz)</th>
            <th>Művelet</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.part_name}</td>
              <td>{task.qty} db</td>
              <td>
                <span className={styles.target}>{task.suggested_slot}</span>
              </td>
              <td>
                <button onClick={() => handleStore(task)}>
                  Elhelyezés kész
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
