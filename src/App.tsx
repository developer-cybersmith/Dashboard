import { Component, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ActivityPage } from './pages/ActivityPage';
import { LoginPage } from './pages/LoginPage';
import { parseExcelFile } from './utils/excelImport';
import './styles/global.css';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error) {
    console.error('[ErrorBoundary]', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, fontFamily:'sans-serif', background:'#0f172a', color:'#e2e8f0' }}>
          <h2 style={{ color:'#f97316' }}>Something went wrong</h2>
          <p style={{ color:'#94a3b8', maxWidth:400, textAlign:'center' }}>{this.state.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', cursor:'pointer' }}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Prevents wheel-scroll increment and auto-selects content on focus for number inputs. */
function useNumberInputBehavior() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.blur();
        e.preventDefault();
      }
    };
    // Select-all on focus so typing immediately replaces the existing value (e.g. "0")
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement && el.type === 'number') {
        // setTimeout lets the browser finish placing the cursor before we select
        setTimeout(() => el.select(), 0);
      }
    };
    document.addEventListener('wheel',   onWheel, { passive: false });
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('wheel',   onWheel);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
}

function ExcelImportListener() {
  const { importData } = useData();
  useNumberInputBehavior();

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
          <Route path="projects"  element={<ProjectsPage />} />
          <Route path="activity"  element={<ActivityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
