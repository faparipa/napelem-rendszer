import { create } from 'zustand';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/expert';

const useProjectStore = create((set, get) => ({
  projects: [],
  parts: [],
  projectParts: [],
  selectedProject: null,
  loading: false,

  getHeaders: () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  // Minden adat kezdeti betöltése
  fetchAllData: async () => {
    set({ loading: true });
    try {
      const headers = get().getHeaders();
      const [pRes, sRes] = await Promise.all([
        axios.get(`${API_BASE}/projects`, { headers }),
        axios.get(`${API_BASE}/parts-with-stock`, { headers }),
      ]);
      set({ projects: pRes.data, parts: sRes.data, loading: false });

      // Ha van kijelölve projekt, frissítsük az adatait a listából
      const current = get().selectedProject;
      if (current) {
        const updated = pRes.data.find((p) => p.id === current.id);
        if (updated) set({ selectedProject: updated });
      }
    } catch (err) {
      console.error('Hiba az adatok letöltésekor', err);
      set({ loading: false });
    }
  },

  // Projekt kiválasztása és alkatrészeinek lekérése
  setSelectedProject: async (project) => {
    set({ selectedProject: project });

    if (project) {
      set({ loading: true }); // Elindítjuk a töltést
      try {
        const res = await axios.get(
          `${API_BASE}/projects/${project.id}/parts`,
          { headers: get().getHeaders() }
        );
        set({ projectParts: res.data });
      } catch (err) {
        console.error('Hiba az alkatrészek betöltésekor', err);
      } finally {
        // Ez a "if (project)" ágon belül maradjon,
        // hogy csak akkor állítsuk le, ha el is indítottuk.
        set({ loading: false });
      }
    } else {
      // Ha nincs projekt (pl. bezárás), ürítjük a listát
      set({ projectParts: [] });
    }
  },

  // Műveletek
  addPart: async (partId, qty) => {
    const { selectedProject, getHeaders, fetchAllData, setSelectedProject } =
      get();
    await axios.post(
      `${API_BASE}/projects/${selectedProject.id}/parts`,
      { part_id: partId, quantity: parseInt(qty) },
      { headers: getHeaders() }
    );
    await fetchAllData();
    await setSelectedProject(get().selectedProject);
  },

  updatePartQty: async (itemId, newQty) => {
    await axios.patch(
      `${API_BASE}/project-parts/${itemId}`,
      { quantity: parseInt(newQty) },
      { headers: get().getHeaders() }
    );
    await get().setSelectedProject(get().selectedProject);
  },

  deletePart: async (itemId) => {
    await axios.delete(`${API_BASE}/project-parts/${itemId}`, {
      headers: get().getHeaders(),
    });
    await get().setSelectedProject(get().selectedProject);
  },

  // finalizeProject: async (hours, price) => {
  //   const { selectedProject, getHeaders, fetchAllData } = get();
  //   await axios.put(
  //     `${API_BASE}/projects/${selectedProject.id}/finalize`,
  //     { estimated_time: hours, price: price },
  //     { headers: getHeaders() }
  //   );
  //   await fetchAllData();
  // },

  finalizeProject: async (hours, price) => {
    const { selectedProject, getHeaders, fetchAllData, projectParts } = get();

    // --- FRONTEND ELLENŐRZÉSEK ---
    const allowedStatuses = ['New', 'Draft', 'Wait', 'InProgress'];
    if (!allowedStatuses.includes(selectedProject.status)) {
      alert(
        `A kalkuláció már be lett küldve! (A projekt jelenlegi állapota: ${selectedProject.status})`
      );
      return; // Megszakítjuk a futást, az API hívás nem fog elindulni!
    }

    if (!projectParts || projectParts.length === 0) {
      alert('Hiba: Legalább egy alkatrészt ki kell választani!');
      return;
    }
    if (hours <= 0 || price <= 0) {
      alert('Hiba: Kérjük, adja meg a munkabért és a becsült időt!');
      return;
    }

    try {
      const response = await axios.put(
        `${API_BASE}/projects/${selectedProject.id}/finalize`,
        { estimated_time: hours, price: price },
        { headers: getHeaders() }
      );

      await fetchAllData();

      // Visszajelzés a backendtől kapott tényleges státusz alapján
      if (response.data.status === 'Scheduled') {
        alert(
          'Sikeres beküldés! Minden alkatrész raktáron van (Állapot: Scheduled).'
        );
      } else {
        alert('Beküldve, de alkatrészhiány van! (Állapot: Wait).');
      }
    } catch (err) {
      console.error('Hiba a véglegesítés során:', err);
      // Ha a backend ad vissza részletes hibaüzenetet (pl. a 400-as hibánál), azt írjuk ki
      const errorMsg =
        err.response?.data?.detail || 'Hiba történt a mentéskor!';
      alert(errorMsg);
    }
  },

  updateStatus: async (newStatus) => {
    const { selectedProject, getHeaders, fetchAllData } = get();
    await axios.put(
      `${API_BASE}/projects/${selectedProject.id}/status`,
      { status: newStatus },
      { headers: getHeaders() }
    );
    await fetchAllData();
  },
}));

export default useProjectStore;
