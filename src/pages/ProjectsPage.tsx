import { Fragment, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2, RefreshCw } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Project, ProjectTester } from '../types';
import { formatCurrency } from '../utils/format';
import { projectTesterCost } from '../utils/analytics';
import { clampPercent } from '../utils/projectProgress';
import { fetchCurrencyRate } from '../utils/api';

const AUTOSAVE_MS = 1500;

const CURRENCIES = [
  { code: 'INR', label: '₹ INR — Indian Rupee' },
  { code: 'USD', label: '$ USD — US Dollar' },
  { code: 'EUR', label: '€ EUR — Euro' },
  { code: 'GBP', label: '£ GBP — British Pound' },
  { code: 'JPY', label: '¥ JPY — Japanese Yen' },
  { code: 'AED', label: 'د.إ AED — UAE Dirham' },
  { code: 'SGD', label: 'S$ SGD — Singapore Dollar' },
  { code: 'CAD', label: 'CA$ CAD — Canadian Dollar' },
  { code: 'AUD', label: 'A$ AUD — Australian Dollar' },
  { code: 'CHF', label: 'Fr CHF — Swiss Franc' },
  { code: 'CNY', label: '¥ CNY — Chinese Yuan' },
  { code: 'MYR', label: 'RM MYR — Malaysian Ringgit' },
];

interface RatePreview { rate: number; amountINR: number; loading: boolean; error: string | null }
const DEFAULT_PREVIEW: RatePreview = { rate: 1, amountINR: 0, loading: false, error: null };

export function ProjectsPage() {
  const { data, metrics, updateProject, addProject, deleteProject } = useData();

  const [drafts,   setDrafts]   = useState<Record<number, Project>>({});
  const [saved,    setSaved]    = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [preview,  setPreview]  = useState<Record<number, RatePreview>>({});
  const [focusId,  setFocusId]  = useState<number | null>(null);

  const timers     = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const rateTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const nameRefs   = useRef<Record<number, HTMLInputElement | null>>({});
  // Always-current preview ref so the auto-save timer reads the latest rate
  const previewRef = useRef(preview);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  // ── Auto-focus when a new project is added ──────────────────────────────
  useEffect(() => {
    if (focusId == null) return;
    // Wait for the row to appear in the DOM
    const el = nameRefs.current[focusId];
    if (el) {
      el.focus();
      el.select();
      setFocusId(null);
    }
  }, [focusId, data.projects]);   // re-evaluate when projects array updates

  const getDraft = (p: Project): Project => drafts[p.id] ?? p;

  const flashSaved = (id: number) => {
    setSaved((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setSaved((prev) => { const n = { ...prev }; delete n[id]; return n; }), 1800);
  };

  const doSave = (id: number, draft: Project) => {
    const pv       = previewRef.current[id];   // read latest preview, not stale closure
    const currency = draft.currency ?? 'INR';

    // Embed the precise converted amountINR from the live preview before persisting
    let toSave = draft;
    if (currency === 'INR') {
      toSave = { ...draft, amountINR: draft.income, exchangeRate: 1, originalAmount: draft.income };
    } else if (pv && !pv.loading && pv.amountINR > 0) {
      toSave = { ...draft, amountINR: pv.amountINR, exchangeRate: pv.rate, originalAmount: draft.income };
    }
    // If preview not ready yet, leave amountINR as-is — backend will compute it

    updateProject(toSave);
    setDrafts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    flashSaved(id);
  };

  const setDraft = (id: number, updater: (prev: Project) => Project) => {
    setDrafts((prev) => {
      const base    = prev[id] ?? data.projects.find((p) => p.id === id)!;
      const updated = updater(base);
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => doSave(id, updated), AUTOSAVE_MS);
      return { ...prev, [id]: updated };
    });
  };

  // Live rate preview (debounced 800 ms) — shown in the income cell and expanded panel
  const scheduleRatePreview = (id: number, currency: string, income: number) => {
    clearTimeout(rateTimers.current[id]);
    if (!currency || currency === 'INR') {
      setPreview((prev) => ({ ...prev, [id]: { rate: 1, amountINR: income, loading: false, error: null } }));
      return;
    }
    setPreview((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_PREVIEW), loading: true, error: null } }));
    rateTimers.current[id] = setTimeout(async () => {
      const result = await fetchCurrencyRate(currency);
      if (result) {
        setPreview((prev) => ({
          ...prev,
          [id]: {
            rate: result.rate,
            amountINR: parseFloat((income * result.rate).toFixed(2)),
            loading: false,
            error: null,
          },
        }));
      } else {
        setPreview((prev) => ({
          ...prev,
          [id]: { ...(prev[id] ?? DEFAULT_PREVIEW), loading: false, error: 'Rate unavailable' },
        }));
      }
    }, 800);
  };

  // Initialise preview when a row is expanded
  useEffect(() => {
    if (expanded == null) return;
    const proj = data.projects.find((p) => p.id === expanded);
    if (!proj) return;
    const draft    = getDraft(proj);
    const currency = draft.currency ?? 'INR';
    if (!preview[expanded]) scheduleRatePreview(expanded, currency, draft.income);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const updateTester = (projectId: number, idx: number, field: keyof ProjectTester, value: string | number) => {
    setDraft(projectId, (prev) => {
      const testers = [...prev.testers];
      testers[idx] = { ...testers[idx], [field]: value };
      return { ...prev, testers };
    });
  };

  const addTester    = (id: number) => setDraft(id, (p) => ({ ...p, testers: [...p.testers, { name: '', monthlyPay: 0 }] }));
  const removeTester = (id: number, i: number) => setDraft(id, (p) => ({ ...p, testers: p.testers.filter((_, j) => j !== i) }));

  // ── Real-time total revenue in INR ────────────────────────────────────────
  // Priority per project:
  //   1. Live preview amountINR (most accurate, updates while user types)
  //   2. Saved project's amountINR from data.projects (set by backend after last save)
  //   3. Draft income (INR projects only)
  const totalIncome = data.projects.reduce((sum, p) => {
    const draft    = drafts[p.id];
    const currency = (draft ?? p).currency ?? 'INR';
    const pv       = preview[p.id];

    if (currency !== 'INR') {
      // Use live preview when available
      if (pv && !pv.loading && pv.amountINR > 0) return sum + pv.amountINR;
      // Fall back to the saved project value (never use draft.amountINR which may be stale 0)
      return sum + (p.amountINR || p.income || 0);
    }

    // INR project: use draft income if editing, otherwise saved income
    return sum + (draft?.income ?? p.income ?? 0);
  }, 0);

  const handleAddProject = () => {
    const newId = addProject({
      company: 'CSS', projectName: 'New Project', category: '', projectLead: '',
      income: 0, currency: 'INR', originalAmount: 0, exchangeRate: 1, amountINR: 0,
      startDate: '', endDate: '', completedWork: '', pendingWork: '', completedPercent: 0, testers: [],
    });
    setFocusId(newId);
    setExpanded(newId); // also expand the new row
  };

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>Projects — Project List</h2>
          <p>Select a currency per project for automatic INR conversion. Changes auto-save.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-purple" onClick={handleAddProject}>
            <Plus size={16} /> Add Project
          </button>
        </div>
      </div>

      <div className="inline-stats">
        <div className="inline-stat"><span>Total Projects</span><strong>{metrics.totalProjects}</strong></div>
        <div className="inline-stat">
          <span>Total Revenue (INR)</span>
          <strong className="live-total">{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="inline-stat"><span>Gross Profit</span><strong>{formatCurrency(metrics.grossProfit)}</strong></div>
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
                <th>Currency</th>
                <th>Income</th>
                <th>INR Value</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Completed Work</th>
                <th>Pending Work</th>
                <th>% Done</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => {
                const draft    = getDraft(project);
                const isDirty  = Boolean(drafts[project.id]);
                const isSaved  = Boolean(saved[project.id]);
                const isOpen   = expanded === project.id;
                const pv       = preview[project.id];
                const currency = draft.currency ?? 'INR';
                const hasFx    = currency !== 'INR';

                // INR value to show in dedicated column
                const inrDisplay = hasFx
                  ? (pv && !pv.loading && pv.amountINR > 0 ? pv.amountINR : (draft.amountINR ?? draft.income))
                  : draft.income;

                return (
                  <Fragment key={project.id}>
                    <tr className={isDirty ? 'dirty-row' : ''}>
                      {/* Expand toggle */}
                      <td>
                        <button type="button" className="icon-btn"
                          onClick={() => setExpanded(isOpen ? null : project.id)}>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>

                      <td>
                        <input value={draft.company}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, company: e.target.value }))} />
                      </td>

                      {/* Project name — ref registered for auto-focus */}
                      <td>
                        <input
                          ref={(el) => { nameRefs.current[project.id] = el; }}
                          value={draft.projectName}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, projectName: e.target.value }))}
                        />
                      </td>

                      <td>
                        <input value={draft.category}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, category: e.target.value }))} />
                      </td>
                      <td>
                        <input value={draft.projectLead}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, projectLead: e.target.value }))} />
                      </td>

                      {/* ── Currency selector column ── */}
                      <td>
                        <select
                          className="currency-col-select"
                          value={currency}
                          onChange={(e) => {
                            const c = e.target.value;
                            setDraft(project.id, (p) => ({ ...p, currency: c }));
                            scheduleRatePreview(project.id, c, draft.income);
                          }}
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.code}</option>
                          ))}
                        </select>
                      </td>

                      {/* Original income in selected currency */}
                      <td className="income-cell">
                        <input type="number" min={0} className="no-spin" value={draft.income}
                          onChange={(e) => {
                            const income = Number(e.target.value) || 0;
                            setDraft(project.id, (p) => ({ ...p, income }));
                            scheduleRatePreview(project.id, currency, income);
                          }} />
                      </td>

                      {/* INR value column — live preview */}
                      <td className="inr-value-cell">
                        {hasFx ? (
                          pv?.loading
                            ? <span className="fx-loading">…</span>
                            : pv?.error
                              ? <span className="fx-error">—</span>
                              : <span className="inr-converted">{formatCurrency(inrDisplay ?? 0)}</span>
                        ) : (
                          <span className="inr-same">{formatCurrency(draft.income)}</span>
                        )}
                      </td>

                      <td>
                        <input type="date" value={draft.startDate}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, startDate: e.target.value }))} />
                      </td>
                      <td>
                        <input type="date" value={draft.endDate}
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, endDate: e.target.value }))} />
                      </td>
                      <td>
                        <input value={draft.completedWork} className="work-input" placeholder="e.g. Network scan"
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, completedWork: e.target.value }))} />
                      </td>
                      <td>
                        <input value={draft.pendingWork} className="work-input" placeholder="e.g. Reporting"
                          onChange={(e) => setDraft(project.id, (p) => ({ ...p, pendingWork: e.target.value }))} />
                      </td>
                      <td>
                        <input type="number" min={0} max={100} className="no-spin percent-input"
                          value={draft.completedPercent}
                          onChange={(e) => setDraft(project.id, (p) => ({
                            ...p, completedPercent: clampPercent(Number(e.target.value) || 0),
                          }))} />
                      </td>

                      {/* Autosave badge + delete */}
                      <td className="action-cell">
                        {isSaved
                          ? <span className="autosave-badge"><CheckCircle2 size={14} /> Saved</span>
                          : isDirty
                            ? <span className="autosave-badge saving">Saving…</span>
                            : null}
                        <button type="button" className="icon-btn delete-btn"
                          onClick={() => deleteProject(project.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>

                    {/* ── Expanded detail row: conversion panel + testers ── */}
                    {isOpen && (
                      <tr className="detail-row">
                        <td colSpan={14}>
                          <div className="tester-section">

                            {/* Currency conversion detail */}
                            {hasFx && (
                              <div className="currency-section">
                                <div className="currency-section-header">Currency Conversion</div>
                                <div className="fx-conversion-box">
                                  {pv?.loading ? (
                                    <span className="fx-loading"><RefreshCw size={13} className="spin-once" /> Fetching rate…</span>
                                  ) : pv?.error ? (
                                    <span className="fx-error">{pv.error}</span>
                                  ) : pv && pv.rate > 0 ? (
                                    <>
                                      <span className="fx-item">
                                        <span className="fx-label">Original</span>
                                        <span className="fx-val">{currency} {(draft.income ?? 0).toLocaleString('en-IN')}</span>
                                      </span>
                                      <span className="fx-sep">·</span>
                                      <span className="fx-item">
                                        <span className="fx-label">Exchange Rate</span>
                                        <span className="fx-val">₹{pv.rate.toFixed(2)}</span>
                                      </span>
                                      <span className="fx-sep">·</span>
                                      <span className="fx-item">
                                        <span className="fx-label">INR Value</span>
                                        <span className="fx-val fx-inr">{formatCurrency(pv.amountINR)}</span>
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            )}

                            {/* Testers */}
                            <div className="tester-header">
                              <div>
                                <strong>Testers</strong>
                                <span>{draft.testers.length} assigned · Cost: {formatCurrency(projectTesterCost(draft))}/mo</span>
                              </div>
                              <button type="button" className="btn btn-outline btn-sm"
                                onClick={() => addTester(project.id)}>
                                <Plus size={14} /> Add Tester
                              </button>
                            </div>
                            <div className="tester-grid">
                              {draft.testers.map((t, i) => (
                                <div key={i} className="tester-row">
                                  <input placeholder="Tester name" value={t.name}
                                    onChange={(e) => updateTester(project.id, i, 'name', e.target.value)} />
                                  <input type="number" min={0} className="no-spin" placeholder="Monthly pay"
                                    value={t.monthlyPay}
                                    onChange={(e) => updateTester(project.id, i, 'monthlyPay', Number(e.target.value) || 0)} />
                                  <button type="button" className="icon-btn delete-btn"
                                    onClick={() => removeTester(project.id, i)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="progress-preview">
                              <span className="progress-tag completed-tag">✓ {draft.completedPercent}%{draft.completedWork && ` — ${draft.completedWork}`}</span>
                              <span className="progress-tag pending-tag">⏳ {100 - draft.completedPercent}%{draft.pendingWork && ` — ${draft.pendingWork}`}</span>
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
                <td colSpan={7}><strong>Total Revenue (INR)</strong></td>
                <td colSpan={2}><strong className="live-total">{formatCurrency(totalIncome)}</strong></td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="panel read-only-preview">
        <h3>Live Dashboard Preview</h3>
        <div className="preview-cards">
          <div><span>Revenue (INR)</span><strong>{formatCurrency(totalIncome)}</strong></div>
          <div><span>Projects</span><strong>{metrics.totalProjects}</strong></div>
          <div><span>Gross Profit</span><strong>{formatCurrency(metrics.grossProfit)}</strong></div>
        </div>
        <ul className="mini-project-list">
          {data.projects.slice(0, 5).map((p) => (
            <li key={p.id}>
              <span>{p.projectName}</span>
              <span>{p.currency && p.currency !== 'INR' ? p.currency : '₹'}</span>
              <span>
                {p.currency && p.currency !== 'INR'
                  ? `${(p.income ?? 0).toLocaleString('en-IN')} → ${formatCurrency(p.amountINR ?? p.income)}`
                  : formatCurrency(p.income)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
