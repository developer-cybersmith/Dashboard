import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { LoginPage } from './pages/LoginPage';
import { parseExcelFile } from './utils/excelImport';
import './styles/global.css';

function ExcelImportListener() {
  const { importData } = useData();

  useEffect(() => {
    const handler = async (e: Event) => {
      const file = (e as CustomEvent<File>).detail;
      try {
        const data = await parseExcelFile(file);
        importData(data);
        alert('Excel data imported successfully!');
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    window.addEventListener('import-excel', handler);
    return () => window.removeEventListener('import-excel', handler);
  }, [importData]);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <DataProvider>
              <ExcelImportListener />
              <Layout />
            </DataProvider>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
