import React, { useState } from 'react';
import PartsManagement from './PartsManagement'; // B.1, B.2
import WarehouseSetup from './WarehouseSetup'; // 1.d
import GoodsInbound from './GoodsInbound'; // B.5, B.6
import styles from './ManagerDashboard.module.css';
import MissingPartsReport from './MissingPartsReport';
import LogoutButton from '../../components/LogoutButton';
import StorageManagement from '../../components/StorageManagement';

const ManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('parts');

  return (
    <div className={styles.dashboardContainer}>
      <nav className={styles.nav}>
        <h2>👷 Raktárvezető Munkalap</h2>
        <LogoutButton />
      </nav>

      {/* Navigációs fülek */}
      <nav className={styles.tabNav}>
        <button
          className={activeTab === 'parts' ? styles.activeTab : ''}
          onClick={() => setActiveTab('parts')}
        >
          📦 Alkatrészek (B.1, B.2)
        </button>
        <button
          className={activeTab === 'inbound' ? styles.activeTab : ''}
          onClick={() => setActiveTab('inbound')}
        >
          🚚 Bevételezés (B.5, B.6)
        </button>
        <button
          className={activeTab === 'setup' ? styles.activeTab : ''}
          onClick={() => setActiveTab('setup')}
        >
          ⚙️ Raktár Konfiguráció (1.d)
        </button>
        <button
          className={activeTab === 'missing_parts' ? styles.activeTab : ''}
          onClick={() => setActiveTab('missing_parts')}
        >
          ⚠️ Hiányzó alkatrészek
        </button>
      </nav>

      {/* Tartalom megjelenítése a választott fül alapján */}
      <main>
        {activeTab === 'parts' && <PartsManagement />}
        {activeTab === 'inbound' && <GoodsInbound />}
        {activeTab === 'setup' && <WarehouseSetup />}
        {activeTab === 'missing_parts' && <MissingPartsReport />}
      </main>
      <div className={styles.content}>
        <StorageManagement />
      </div>
    </div>
  );
};

export default ManagerDashboard;
