import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ActivityItem, AppData, Employee, Project } from '../types';
import { computeMetrics } from '../utils/analytics';
import { normalizeProject } from '../utils/projectProgress';
import {
  fetchData,
  nextId,
  resetData as apiReset,
  saveData as apiSave,
  type ConnectionState,
} from '../utils/api';

interface DataContextValue {
  data: AppData;
  metrics: ReturnType<typeof computeMetrics>;
  activities: ActivityItem[];
  connection: ConnectionState;
  loading: boolean;
  updateEmployee: (employee: Employee) => void;
  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  deleteEmployee: (id: number) => void;
  updateProject: (project: Project) => void;
  addProject: (project: Omit<Project, 'id'>) => void;
  deleteProject: (id: number) => void;
  importData: (data: AppData) => void;
  resetToInitial: () => void;
  refresh: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY: AppData = { employees: [], projects: [] };

function normalizeEmployee(e: unknown): Employee {
  const emp = (e ?? {}) as Record<string, unknown>;
  return {
    id:          Number(emp.id)          || 0,
    name:        String(emp.name         ?? ''),
    designation: String(emp.designation  ?? ''),
    monthlyPay:  Number(emp.monthlyPay)  || 0,
  };
}

function normalizeData(data: unknown): AppData {
  const raw = (data ?? {}) as Record<string, unknown>;
  const employees = Array.isArray(raw.employees) ? raw.employees : [];
  const projects  = Array.isArray(raw.projects)  ? raw.projects  : [];
  return {
    employees: employees.map(normalizeEmployee),
    projects:  projects.map(normalizeProject),
  };
}

function logActivity(
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>,
  message: string,
  type: ActivityItem['type'],
) {
  const item: ActivityItem = {
    id: crypto.randomUUID(),
    message,
    time: new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    type,
  };
  setActivities((prev) => [item, ...prev].slice(0, 20));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: fetched, online } = await fetchData();
      setData(normalizeData(fetched));
      setConnection(online ? 'online' : 'offline');
    } catch (err) {
      console.error('[DataContext] load failed:', err);
      setConnection('offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback((next: AppData) => {
    setData(next);
    void apiSave(next).then((ok) => {
      setConnection(ok ? 'online' : 'offline');
    });
  }, []);

  const metrics = useMemo(() => computeMetrics(data), [data]);

  const updateEmployee = useCallback(
    (employee: Employee) => {
      persist({
        ...data,
        employees: data.employees.map((e) =>
          e.id === employee.id ? employee : e,
        ),
      });
      logActivity(setActivities, `Employee "${employee.name}" updated`, 'employee');
    },
    [data, persist],
  );

  const addEmployee = useCallback(
    (employee: Omit<Employee, 'id'>) => {
      const newEmp: Employee = { ...employee, id: nextId(data.employees) };
      persist({ ...data, employees: [...data.employees, newEmp] });
      logActivity(setActivities, `Employee "${newEmp.name}" added`, 'employee');
    },
    [data, persist],
  );

  const deleteEmployee = useCallback(
    (id: number) => {
      const emp = data.employees.find((e) => e.id === id);
      persist({
        ...data,
        employees: data.employees.filter((e) => e.id !== id),
      });
      if (emp) {
        logActivity(setActivities, `Employee "${emp.name}" removed`, 'employee');
      }
    },
    [data, persist],
  );

  const updateProject = useCallback(
    (project: Project) => {
      persist({
        ...data,
        projects: data.projects.map((p) =>
          p.id === project.id ? project : p,
        ),
      });
      logActivity(
        setActivities,
        `Project "${project.projectName}" updated`,
        'project',
      );
    },
    [data, persist],
  );

  const addProject = useCallback(
    (project: Omit<Project, 'id'>) => {
      const newProj: Project = { ...project, id: nextId(data.projects) };
      persist({ ...data, projects: [...data.projects, newProj] });
      logActivity(
        setActivities,
        `Project "${newProj.projectName}" added`,
        'project',
      );
    },
    [data, persist],
  );

  const deleteProject = useCallback(
    (id: number) => {
      const proj = data.projects.find((p) => p.id === id);
      persist({
        ...data,
        projects: data.projects.filter((p) => p.id !== id),
      });
      if (proj) {
        logActivity(
          setActivities,
          `Project "${proj.projectName}" removed`,
          'project',
        );
      }
    },
    [data, persist],
  );

  const importData = useCallback(
    (incoming: AppData) => {
      persist(normalizeData(incoming));
      logActivity(setActivities, 'Data imported from Excel', 'salary');
    },
    [persist],
  );

  const resetToInitial = useCallback(async () => {
    const initial = await apiReset();
    setData(normalizeData(initial));
    setActivities([]);
    logActivity(setActivities, 'Data reset to original Excel', 'salary');
  }, []);

  const value: DataContextValue = {
    data,
    metrics,
    activities,
    connection,
    loading,
    updateEmployee,
    addEmployee,
    deleteEmployee,
    updateProject,
    addProject,
    deleteProject,
    importData,
    resetToInitial,
    refresh: load,
  };

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
