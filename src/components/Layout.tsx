import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useData } from '../context/DataContext';

export function Layout() {
  const [search, setSearch] = useState('');
  const { loading } = useData();

  return (
    <div className="app-shell">
      <div className="bg-fx" aria-hidden>
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="grid-overlay" />
      </div>

      <Sidebar />
      <div className="main-area">
        <Header search={search} onSearchChange={setSearch} />
        <main className="page-content">
          {loading ? (
            <div className="loading-screen">
              <div className="loader-ring" />
              <p>Connecting to backend & loading data…</p>
            </div>
          ) : (
            <Outlet context={{ search }} />
          )}
        </main>
      </div>
    </div>
  );
}
