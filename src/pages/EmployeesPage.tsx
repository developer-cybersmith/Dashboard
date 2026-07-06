import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/format';

const AUTOSAVE_MS = 1500;

export function EmployeesPage() {
  const { data, metrics, updateEmployee, addEmployee, deleteEmployee, resetToInitial } = useData();
  const [drafts,  setDrafts]  = useState<Record<number, Employee>>({});
  const [saved,   setSaved]   = useState<Record<number, boolean>>({});
  const [focusId, setFocusId] = useState<number | null>(null);
  const timers   = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const nameRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Auto-focus the name input of a newly added employee
  useEffect(() => {
    if (focusId == null) return;
    const el = nameRefs.current[focusId];
    if (el) { el.focus(); el.select(); setFocusId(null); }
  }, [focusId, data.employees]);

  const getDraft = (emp: Employee): Employee => drafts[emp.id] ?? emp;

  const flashSaved = (id: number) => {
    setSaved((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setSaved((prev) => { const n = { ...prev }; delete n[id]; return n; }), 1800);
  };

  const doSave = (id: number, draft: Employee) => {
    updateEmployee(draft);
    setDrafts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    flashSaved(id);
  };

  const setDraftField = (id: number, emp: Employee, field: keyof Employee, value: string | number) => {
    const updated = { ...getDraft(emp), [field]: value };
    setDrafts((prev) => ({ ...prev, [id]: updated }));

    // debounced auto-save
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => doSave(id, updated), AUTOSAVE_MS);
  };

  const totalPayroll = data.employees.reduce((s, e) => s + e.monthlyPay, 0);

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>Employees — Monthly Pay</h2>
          <p>Changes are auto-saved automatically.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-blue"
            onClick={() => { const newId = addEmployee({ name: 'New Employee', designation: '', monthlyPay: 0 }); setFocusId(newId); }}>
            <Plus size={16} /> Add Employee
          </button>
          <button type="button" className="btn btn-outline" onClick={resetToInitial}>
            <RotateCcw size={16} /> Reset Data
          </button>
        </div>
      </div>

      <div className="inline-stats">
        <div className="inline-stat"><span>Total Employees</span><strong>{metrics.totalEmployees}</strong></div>
        <div className="inline-stat"><span>Total Monthly Payroll</span><strong>{formatCurrency(totalPayroll)}</strong></div>
        <div className="inline-stat"><span>Dashboard Salary Cost</span><strong>{formatCurrency(metrics.totalSalaryCost)}</strong></div>
      </div>

      <div className="panel table-panel editable-panel">
        <div className="table-wrap">
          <table className="editable-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Monthly Pay (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp, idx) => {
                const draft   = getDraft(emp);
                const isDirty = Boolean(drafts[emp.id]);
                const isSaved = Boolean(saved[emp.id]);
                return (
                  <tr key={emp.id} className={isDirty ? 'dirty-row' : ''}>
                    <td>{idx + 1}</td>
                    <td>
                      <input
                        ref={(el) => { nameRefs.current[emp.id] = el; }}
                        value={draft.name}
                        onChange={(e) => setDraftField(emp.id, emp, 'name', e.target.value)} />
                    </td>
                    <td>
                      <input value={draft.designation} placeholder="Designation"
                        onChange={(e) => setDraftField(emp.id, emp, 'designation', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min={0} className="no-spin" value={draft.monthlyPay}
                        onChange={(e) => setDraftField(emp.id, emp, 'monthlyPay', Number(e.target.value) || 0)} />
                    </td>
                    <td className="action-cell">
                      {isSaved ? (
                        <span className="autosave-badge"><CheckCircle2 size={14} /> Saved</span>
                      ) : isDirty ? (
                        <span className="autosave-badge saving">Saving…</span>
                      ) : null}
                      <button type="button" className="icon-btn delete-btn" title="Delete"
                        onClick={() => deleteEmployee(emp.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Total</strong></td>
                <td><strong>{formatCurrency(totalPayroll)}</strong></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
