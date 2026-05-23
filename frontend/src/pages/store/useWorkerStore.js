import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const useWorkerStore = create((set, get) => ({
  projects: [],
  selectedProject: null,
  pickingList: [],
  projectDetails: { can_complete: false },
  allSlots: [],
  parts: [],
  slotsStatus: [],
  timelineLogs: [],
  loadingLogs: false,

  getHeaders: () => {
    const token = localStorage.getItem('token');
    return { Authorization: token ? `Bearer ${token}` : '' };
  },

  // Választható projektek kiszűrése és betöltése
  loadProjects: async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/warehouse/reports/project-requirements`,
        {
          headers: get().getHeaders(),
        }
      );
      const unique = [];
      const map = new Map();
      for (const item of res.data) {
        if (!map.has(item.project_id)) {
          map.set(item.project_id, true);
          unique.push({ id: item.project_id, location: item.location });
        }
      }
      set({ projects: unique });
    } catch (err) {
      console.error('Hiba a projektek betöltésekor:', err);
    }
  },

  // Projekt kiválasztása és a kiszedési lista lekérése
  selectProject: async (projectId) => {
    if (!projectId) {
      set({
        selectedProject: null,
        pickingList: [],
        projectDetails: { can_complete: false },
      });
      return;
    }
    try {
      const res = await axios.get(
        `${API_BASE}/warehouse/projects/${projectId}/picking-list`,
        {
          headers: get().getHeaders(),
        }
      );
      set({
        pickingList: res.data.picking_steps,
        projectDetails: res.data.project_info,
        selectedProject: projectId,
      });
    } catch (err) {
      console.error('Hiba a projekt részleteinek lekérésekor:', err);
    }
  },

  // Kiszedés megerősítése és lezárása
  completePicking: async () => {
    const { selectedProject } = get();
    if (!selectedProject) return;

    try {
      await axios.patch(
        `${API_BASE}/warehouse/projects/${selectedProject}/confirm-and-close`,
        {},
        { headers: get().getHeaders() }
      );

      // Állapotok azonnali ürítése a duplikált kattintások elkerülésére
      set({
        selectedProject: null,
        pickingList: [],
        projectDetails: { can_complete: false },
      });

      // Lista frissítése
      await get().loadProjects();
      alert('Kész!');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Hiba a lezárás során!';
      alert(errorMsg);
    }
  },

  // Térkép státusz (Metszet / koordináták) lekérése
  fetchMapStatus: async () => {
    try {
      const res = await axios.get(`${API_BASE}/warehouse/status`, {
        headers: get().getHeaders(),
      });
      set({ allSlots: res.data });
    } catch (err) {
      console.error('Hiba a raktár térkép lekérésekor:', err);
    }
  },

  // Elérhető alkatrészek listája a manuális bevételezéshez
  fetchParts: async () => {
    try {
      const res = await axios.get(`${API_BASE}/parts`, {
        headers: get().getHeaders(),
      });
      set({ parts: res.data });
    } catch (err) {
      console.error('Hiba az alkatrészek lekérésekor:', err);
    }
  },

  // Manuális készletmódosítás egy adott rekeszben
  updateStock: async (slotId, partId, amount) => {
    try {
      await axios.post(
        `${API_BASE}/warehouse/update-stock?slot_id=${slotId}&part_id=${partId}&quantity=${amount}`,
        {},
        { headers: get().getHeaders() }
      );
      await get().fetchMapStatus();
      // Ha a StorageManagement is nyitva van, frissítjük azt is
      get().fetchSlotsStatus();
      alert('Raktárkészlet sikeresen frissítve!');
    } catch (err) {
      alert('Hiba történt: ' + (err.response?.data?.detail || 'Hálózati hiba'));
      throw err;
    }
  },

  // Rekeszek és Tárhelyek globális állapota (StorageManagement panelhez)
  fetchSlotsStatus: async () => {
    try {
      const res = await axios.get(`${API_BASE}/warehouse/slots-status`, {
        headers: get().getHeaders(),
      });
      set({ slotsStatus: res.data });
    } catch (err) {
      console.error('Hiba a rekeszek betöltésekor:', err);
    }
  },

  // Projekt Életút Napló lekérése
  fetchProjectLogs: async (projectId) => {
    if (!projectId) return;
    set({ loadingLogs: true });
    try {
      const res = await axios.get(
        `${API_BASE}/expert/projects/${projectId}/logs`,
        {
          headers: get().getHeaders(),
        }
      );
      set({ timelineLogs: res.data });
    } catch (err) {
      console.error('Hiba a napló lekérésekor:', err);
    } finally {
      set({ loadingLogs: false });
    }
  },
}));

export default useWorkerStore;
