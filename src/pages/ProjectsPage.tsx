import { Fragment, useState } from 'react';
import { Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Project, ProjectTester } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { projectTesterCost } from '../utils/analytics';
import { clampPercent } from '../utils/projectProgress';

export function ProjectsPage() {
  const { data, metrics, updateProject, addProject, deleteProject } =
    useData();
  const [drafts, setDrafts] = useState<Record<number, Project>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const getDraft = (p: Project): Project => drafts[p.id] ?? p;

  const setDraft = (id: number, updater: (prev: Project) => Project) => {
    setDrafts((prev) => {
      const base = prev[id] ?? data.projects.find((p) => p.id === id)!;
      return { ...prev, [id]: updater(base) };
    });
  };

  const saveRow = (project: Project) => {
    const draft = drafts[project.id];
    if (draft) {
      updateProject(draft);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
    }
  };

  const updateTester = (
    projectId: number,
    testerIdx: number,
    field: keyof ProjectTester,
    value: string | number,
  ) => {
    setDraft(projectId, (prev) => {
      const testers = [...prev.testers];
      testers[testerIdx] = { ...testers[testerIdx], [field]: value };
      return { ...prev, testers };
    });
  };

  const addTester = (projectId: number) => {
    setDraft(projectId, (prev) => ({
      ...prev,
      testers: [...prev.testers, { name: '', monthlyPay: 0 }],
    }));
  };

  const removeTester = (projectId: number, idx: number) => {
    setDraft(projectId, (prev) => ({
      ...prev,
      testers: prev.testers.filter((_, i) => i !== idx),
    }));
  };

  const totalIncome = data.projects.reduce((s, p) => s + p.income, 0);

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>Projects — Project List</h2>
          <p>
            Edit project details, income, dates, and assigned testers. Dashboard
            updates automatically.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-purple"
            onClick={() =>
              addProject({
                company: 'CSS',
                projectName: 'New Project',
                category: '',
                projectLead: '',
                income: 0,
                startDate: '',
                endDate: '',
                completedWork: '',
                pendingWork: '',
                completedPercent: 0,
                testers: [],
              })
            }
          >
            <Plus size={16} /> Add Project
          </button>
        </div>
      </div>

      <div className="inline-stats">
        <div className="inline-stat">
          <span>Total Projects</span>
          <strong>{metrics.totalProjects}</strong>
        </div>
        <div className="inline-stat">
          <span>Total Project Income</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="inline-stat">
          <span>Dashboard Revenue</span>
          <strong>{formatCurrency(metrics.totalRevenue)}</strong>
        </div>
      </div>

      <div className="panel table-panel editable-panel">
        <div className="table-wrap">
          <table className="editable-table projects-table">
            <thead>
              <tr>
                <th />
                <th>Company</th>
                <th>Project Name</th>
                <th>Category</th>
                <th>Project Lead</th>
                <th>Income (₹)</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Completed Work</th>
                <th>Pending Work</th>
                <th>% Done</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => {
                const draft = getDraft(project);
                const isDirty = Boolean(drafts[project.id]);
                const isOpen = expanded === project.id;
                return (
                  <Fragment key={project.id}>
                    <tr className={isDirty ? 'dirty-row' : ''}>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() =>
                            setExpanded(isOpen ? null : project.id)
                          }
                        >
                          {isOpen ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </td>
                      <td>
                        <input
                          value={draft.company}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              company: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.projectName}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              projectName: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.category}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              category: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.projectLead}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              projectLead: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={draft.income}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              income: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              startDate: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              endDate: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.completedWork}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              completedWork: e.target.value,
                            }))
                          }
                          className="work-input"
                          placeholder="e.g. Network scan, VAPT"
                        />
                      </td>
                      <td>
                        <input
                          value={draft.pendingWork}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              pendingWork: e.target.value,
                            }))
                          }
                          className="work-input"
                          placeholder="e.g. Reporting, Follow-up"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.completedPercent}
                          onChange={(e) =>
                            setDraft(project.id, (p) => ({
                              ...p,
                              completedPercent: clampPercent(
                                Number(e.target.value) || 0,
                              ),
                            }))
                          }
                          className="percent-input"
                          title="Percentage of project completed (0–100)"
                        />
                      </td>
                      <td className="action-cell">
                        <button
                          type="button"
                          className="icon-btn save-btn"
                          disabled={!isDirty}
                          onClick={() => saveRow(project)}
                        >
                          <Save size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn delete-btn"
                          onClick={() => deleteProject(project.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td colSpan={12}>
                          <div className="tester-section">
                            <div className="tester-header">
                              <div>
                                <strong>Testers</strong>
                                <span>
                                  {draft.testers.length} assigned · Cost:{' '}
                                  {formatCurrency(projectTesterCost(draft))}/mo
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => addTester(project.id)}
                              >
                                <Plus size={14} /> Add Tester
                              </button>
                            </div>
                            <div className="tester-grid">
                              {draft.testers.map((t, i) => (
                                <div key={i} className="tester-row">
                                  <input
                                    placeholder="Tester name"
                                    value={t.name}
                                    onChange={(e) =>
                                      updateTester(
                                        project.id,
                                        i,
                                        'name',
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="Monthly pay"
                                    value={t.monthlyPay}
                                    onChange={(e) =>
                                      updateTester(
                                        project.id,
                                        i,
                                        'monthlyPay',
                                        Number(e.target.value) || 0,
                                      )
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="icon-btn delete-btn"
                                    onClick={() => removeTester(project.id, i)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="progress-preview">
                              <span className="progress-tag completed-tag">
                                ✓ Completed: {draft.completedPercent}%
                                {draft.completedWork && ` — ${draft.completedWork}`}
                              </span>
                              <span className="progress-tag pending-tag">
                                ⏳ Pending: {100 - draft.completedPercent}%
                                {draft.pendingWork && ` — ${draft.pendingWork}`}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}><strong>Total Income</strong></td>
                <td><strong>{formatCurrency(totalIncome)}</strong></td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="panel read-only-preview">
        <h3>Live Dashboard Preview</h3>
        <div className="preview-cards">
          <div>
            <span>Revenue</span>
            <strong>{formatCurrency(metrics.totalRevenue)}</strong>
          </div>
          <div>
            <span>Projects</span>
            <strong>{metrics.totalProjects}</strong>
          </div>
          <div>
            <span>Gross Profit</span>
            <strong>{formatCurrency(metrics.grossProfit)}</strong>
          </div>
        </div>
        <ul className="mini-project-list">
          {data.projects.slice(0, 5).map((p) => (
            <li key={p.id}>
              <span>{p.projectName}</span>
              <span>{p.company}</span>
              <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
