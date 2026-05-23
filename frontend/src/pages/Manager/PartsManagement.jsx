// import { useState, useEffect } from 'react';
// import axios from 'axios';
// import styles from './PartsManagement.module.css';

// const PartsManagement = () => {
//   const [parts, setParts] = useState([]);
//   const [newPart, setNewPart] = useState({
//     name: '',
//     price: '',
//     max_per_slot: 10,
//   });
//   const [editingId, setEditingId] = useState(null);
//   const [editPrice, setEditPrice] = useState('');
//   const [editMax, setEditMax] = useState('');
//   const token = localStorage.getItem('token');

//   const fetchParts = async () => {
//     try {
//       // 1. Token kiolvasása a localStorage-ból
//       const token = localStorage.getItem('token');

//       // 2. Kérés küldése a JÓ URL-re és a fejléccel
//       const response = await axios.get(
//         'http://localhost:8000/warehouse/parts',
//         {
//           headers: {
//             Authorization: `Bearer ${token}`, // <--- Ez kötelező!
//           },
//         }
//       );

//       setParts(response.data);
//     } catch (error) {
//       console.error('Hiba az alkatrészek lekérésekor', error);
//       if (error.response?.status === 401) {
//         alert('Lejárt a munkamenet vagy nincs jogosultsága!');
//       }
//     }
//   };

//   useEffect(() => {
//     fetchParts();
//   }, []);

//   const handleCreate = async (e) => {
//     e.preventDefault();
//     try {
//       await axios.post('http://localhost:8000/parts', newPart, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       setNewPart({ name: '', price: '', max_per_slot: 10 });
//       fetchParts();
//     } catch (err) {
//       alert('Hiba: ' + (err.response?.data?.detail || 'Sikertelen mentés'));
//     }
//   };

//   const handleUpdatePrice = async (id) => {
//     try {
//       await axios.patch(
//         `http://localhost:8000/parts/${id}`,
//         { price: parseFloat(editPrice) },
//         {
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );
//       setEditingId(null);
//       fetchParts();
//     } catch (err) {
//       alert('Hiba az ár frissítésekor');
//     }
//   };

//   return (
//     <div className={styles.container}>
//       <h2>Alkatrészek kezelése</h2>

//       <div className={styles.formSection}>
//         <h4>Új alkatrész rögzítése</h4>
//         <form onSubmit={handleCreate} className={styles.formGrid}>
//           <div className={styles.inputGroup}>
//             <label>Alkatrész neve</label>
//             <input
//               className={styles.input}
//               value={newPart.name}
//               onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
//               required
//             />
//           </div>
//           <div className={styles.inputGroup}>
//             <label>Egységár (Ft)</label>
//             <input
//               type='number'
//               className={styles.input}
//               value={newPart.price}
//               onChange={(e) =>
//                 setNewPart({ ...newPart, price: e.target.value })
//               }
//               required
//             />
//           </div>
//           <div className={styles.inputGroup}>
//             <label>Max/Slot</label>
//             <input
//               type='number'
//               className={styles.input}
//               value={newPart.max_per_slot}
//               onChange={(e) =>
//                 setNewPart({ ...newPart, max_per_slot: e.target.value })
//               }
//               required
//             />
//           </div>
//           <button type='submit' className={styles.addBtn}>
//             Rögzítés
//           </button>
//         </form>
//       </div>

//       <table className={styles.partsTable}>
//         <thead>
//           <tr>
//             <th>ID</th>
//             <th>Név</th>
//             <th>Egységár</th>
//             <th>Raktáron</th>
//             <th>Max/Slot</th>
//             <th>Műveletek</th>
//           </tr>
//         </thead>
//         <tbody>
//           {parts.map((part) => (
//             <tr key={part.id}>
//               <td>{part.id}</td>
//               <td>{part.name}</td>
//               <td>
//                 {editingId === part.id ? (
//                   <input
//                     type='number'
//                     className={styles.priceInput}
//                     value={editPrice}
//                     onChange={(e) => setEditPrice(e.target.value)}
//                   />
//                 ) : (
//                   `${part.price.toLocaleString()} Ft`
//                 )}
//               </td>
//               <td
//                 style={{
//                   fontWeight: 'bold',
//                   color: part.total_stock > 0 ? 'green' : 'red',
//                 }}
//               >
//                 {part.total_stock} db
//               </td>
//               <td>{part.max_per_slot} db</td>
//               <td>
//                 {editingId === part.id ? (
//                   <button
//                     onClick={() => handleUpdatePrice(part.id)}
//                     className={styles.saveBtn}
//                   >
//                     Mentés
//                   </button>
//                 ) : (
//                   <button
//                     onClick={() => {
//                       setEditingId(part.id);
//                       setEditPrice(part.price);
//                     }}
//                     className={styles.editBtn}
//                   >
//                     Ár módosítása
//                   </button>
//                 )}
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default PartsManagement;

import { useState, useEffect } from 'react';
import styles from './PartsManagement.module.css';
import useWarehouseStore from '../store/useWarehouseStore';

const PartsManagement = () => {
  const { parts, fetchWarehouseParts, createPart, updatePartPrice } =
    useWarehouseStore();

  const [newPart, setNewPart] = useState({
    name: '',
    price: '',
    max_per_slot: 10,
  });
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    fetchWarehouseParts();
  }, [fetchWarehouseParts]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createPart(newPart);
      setNewPart({ name: '', price: '', max_per_slot: 10 });
    } catch (err) {
      // A hiba kezelést a store elintézi, de az input ürítést így megakadályozzuk hiba esetén
    }
  };

  const handleUpdatePrice = async (id) => {
    await updatePartPrice(id, editPrice);
    setEditingId(null);
  };

  return (
    <div className={styles.container}>
      <h2>Alkatrészek kezelése</h2>

      <div className={styles.formSection}>
        <h4>Új alkatrész rögzítése</h4>
        <form onSubmit={handleCreate} className={styles.formGrid}>
          <div className={styles.inputGroup}>
            <label>Alkatrész neve</label>
            <input
              className={styles.input}
              value={newPart.name}
              onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Egységár (Ft)</label>
            <input
              type='number'
              className={styles.input}
              value={newPart.price}
              onChange={(e) =>
                setNewPart({ ...newPart, price: e.target.value })
              }
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Max/Slot</label>
            <input
              type='number'
              className={styles.input}
              value={newPart.max_per_slot}
              onChange={(e) =>
                setNewPart({ ...newPart, max_per_slot: e.target.value })
              }
              required
            />
          </div>
          <button type='submit' className={styles.addBtn}>
            Rögzítés
          </button>
        </form>
      </div>

      <table className={styles.partsTable}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Név</th>
            <th>Egységár</th>
            <th>Raktáron</th>
            <th>Max/Slot</th>
            <th>Műveletek</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id}>
              <td>{part.id}</td>
              <td>{part.name}</td>
              <td>
                {editingId === part.id ? (
                  <input
                    type='number'
                    className={styles.priceInput}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                ) : (
                  `${part.price?.toLocaleString()} Ft`
                )}
              </td>
              <td
                style={{
                  fontWeight: 'bold',
                  color: part.total_stock > 0 ? 'green' : 'red',
                }}
              >
                {part.total_stock} db
              </td>
              <td>{part.max_per_slot} db</td>
              <td>
                {editingId === part.id ? (
                  <button
                    onClick={() => handleUpdatePrice(part.id)}
                    className={styles.saveBtn}
                  >
                    Mentés
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(part.id);
                      setEditPrice(part.price);
                    }}
                    className={styles.editBtn}
                  >
                    Ár módosítása
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartsManagement;
