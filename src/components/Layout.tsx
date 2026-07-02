import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useData } from '../context/DataContext';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading } = useData();

  return (
    <div className="app-shell">
      <div className="bg-fx" aria-hidden>
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="grid-overlay" />
      </div>

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="page-content">
          {loading ? (
            <div className="loading-screen">
              <div className="loader-ring" />
              <p>Connecting to backend & loading data…</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
