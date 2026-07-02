import { useState } from 'react';
import { Plus, Save, Trash2, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/format';

export function EmployeesPage() {
  const {
    data,
    metrics,
    updateEmployee,
    addEmployee,
    deleteEmployee,
    resetToInitial,
  } = useData();
  const [drafts, setDrafts] = useState<Record<number, Employee>>({});

  const getDraft = (emp: Employee): Employee => drafts[emp.id] ?? emp;

  const setDraftField = (
    id: number,
    emp: Employee,
    field: keyof Employee,
    value: string | number,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(emp), [field]: value },
    }));
  };

  const saveRow = (emp: Employee) => {
    const draft = drafts[emp.id];
    if (draft) {
      updateEmployee(draft);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      });
    }
  };

  const totalPayroll = data.employees.reduce((s, e) => s + e.monthlyPay, 0);

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>Employees — Monthly Pay</h2>
          <p>
            Edit employee salary details. Changes sync instantly to the dashboard.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-blue"
            onClick={() =>
              addEmployee({ name: 'New Employee', designation: '', monthlyPay: 0 })
            }
          >
            <Plus size={16} /> Add Employee
          </button>
          <button type="button" className="btn btn-outline" onClick={resetToInitial}>
            <RotateCcw size={16} /> Reset Data
          </button>
        </div>
      </div>

      <div className="inline-stats">
        <div className="inline-stat">
          <span>Total Employees</span>
          <strong>{metrics.totalEmployees}</strong>
        </div>
        <div className="inline-stat">
          <span>Total Monthly Payroll</span>
          <strong>{formatCurrency(totalPayroll)}</strong>
        </div>
        <div className="inline-stat">
          <span>Dashboard Salary Cost</span>
          <strong>{formatCurrency(metrics.totalSalaryCost)}</strong>
        </div>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp, idx) => {
                const draft = getDraft(emp);
                const isDirty = Boolean(drafts[emp.id]);
                return (
                  <tr key={emp.id} className={isDirty ? 'dirty-row' : ''}>
                    <td>{idx + 1}</td>
                    <td>
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setDraftField(emp.id, emp, 'name', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={draft.designation}
                        onChange={(e) =>
                          setDraftField(emp.id, emp, 'designation', e.target.value)
                        }
                        placeholder="Designation"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={draft.monthlyPay}
                        onChange={(e) =>
                          setDraftField(
                            emp.id,
                            emp,
                            'monthlyPay',
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </td>
                    <td className="action-cell">
                      <button
                        type="button"
                        className="icon-btn save-btn"
                        title="Save"
                        disabled={!isDirty}
                        onClick={() => saveRow(emp)}
                      >
                        <Save size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn delete-btn"
                        title="Delete"
                        onClick={() => deleteEmployee(emp.id)}
                      >
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
