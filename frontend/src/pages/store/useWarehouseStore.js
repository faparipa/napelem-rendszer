import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const useWarehouseStore = create((set, get) => ({
  parts: [],
  missingPartsReport: [],
  inboundHistory: [],
  loading: false,

  getHeaders: () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  // Alkatrészek lekérése (raktár specifikus)
  fetchWarehouseParts: async () => {
    set({ loading: true });
    try {
      const res = await axios.get(`${API_BASE}/warehouse/parts`, {
        headers: get().getHeaders(),
      });
      set({ parts: res.data });
    } catch (err) {
      console.error('Hiba az alkatrészek lekérésekor:', err);
      if (err.response?.status === 401) {
        alert('Lejárt a munkamenet vagy nincs jogosultsága!');
      }
    } finally {
      set({ loading: false });
    }
  },

  // Hiányzó alkatrészek riport lekérése
  fetchMissingPartsReport: async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/warehouse/reports/missing-parts`,
        {
          headers: get().getHeaders(),
        }
      );
      set({ missingPartsReport: res.data });
    } catch (err) {
      console.error('Hiba a hiányjelentés letöltésekor:', err);
    }
  },

  // Új alkatrész rögzítése
  createPart: async (newPartData) => {
    try {
      await axios.post(`${API_BASE}/parts`, newPartData, {
        headers: get().getHeaders(),
      });
      await get().fetchWarehouseParts();
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Sikertelen mentés'));
      throw err;
    }
  },

  // Egységár frissítése
  updatePartPrice: async (id, price) => {
    try {
      await axios.patch(
        `${API_BASE}/parts/${id}`,
        { price: parseFloat(price) },
        { headers: get().getHeaders() }
      );
      await get().fetchWarehouseParts();
    } catch (err) {
      alert('Hiba az ár frissítésekor');
    }
  },

  // Automata bevételezés optimális elosztással
  executeAutoInbound: async (partId, quantity) => {
    set({ loading: true });
    try {
      const response = await axios.post(
        `${API_BASE}/warehouse/auto-inbound`,
        { part_id: parseInt(partId), quantity: parseInt(quantity) },
        { headers: get().getHeaders() }
      );

      const selectedPart = get().parts.find((p) => p.id === parseInt(partId));
      const newEntry = {
        partName: selectedPart?.name || 'Ismeretlen alkatrész',
        totalQuantity: quantity,
        allocation: response.data.allocation,
      };

      set((state) => ({
        inboundHistory: [...state.inboundHistory, newEntry],
      }));

      alert('Sikeres automatikus bevételezés!');
      await get().fetchWarehouseParts(); // Frissítjük a készletet a felületen is
    } catch (err) {
      alert('Hiba: ' + (err.response?.data?.detail || 'Hiba történt'));
    } finally {
      set({ loading: false });
    }
  },

  // Raktár alapkonfiguráció generálása
  setupWarehouse: async (dims) => {
    try {
      const res = await axios.post(
        `${API_BASE}/warehouse/setup-warehouse?rows=${dims.rows}&cols=${dims.cols}&levels=${dims.levels}&slots_per_level=${dims.slotsPerLevel}`,
        {},
        { headers: get().getHeaders() }
      );
      alert(res.data.message);
    } catch (err) {
      alert(
        'Hiba: ' + (err.response?.data?.detail || 'Hiba a generálás során.')
      );
    }
  },

  // Raktár bővítése query paraméterekkel
  expandWarehouse: async (config) => {
    try {
      await axios.post(`${API_BASE}/warehouse/expand-warehouse`, null, {
        params: {
          add_rows: config.addRows,
          add_cols: config.addCols,
          levels: config.levels,
          slots_per_level: config.slotsPerLevel,
        },
        headers: get().getHeaders(),
      });
      alert('Bővítés sikeres!');
    } catch (err) {
      console.error(err);
      alert('Hiba történt a bővítés során.');
    }
  },
}));

export default useWarehouseStore;
