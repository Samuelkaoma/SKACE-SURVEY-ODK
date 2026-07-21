/**
 * @fileoverview Main Application Root with layout and routing.
 */
import React, { useState } from 'react';
import { DataProvider } from './store/useDataStore.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import Header from './components/layout/Header.jsx';
import Overview from './pages/Overview.jsx';
import Anomalies from './pages/Anomalies.jsx';
import Features from './pages/Features.jsx';
import Notebook from './pages/Notebook.jsx';
import DataView from './pages/DataView.jsx';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('Overview');

  const renderPage = () => {
    switch (currentPage) {
      case 'Overview':  return <Overview />;
      case 'Anomalies': return <Anomalies />;
      case 'Features':  return <Features />;
      case 'Notebook':  return <Notebook />;
      case 'DataExplorer': return <DataView />;
      default:          return <Overview />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
        <Header currentPage={currentPage} />

        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
        }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
