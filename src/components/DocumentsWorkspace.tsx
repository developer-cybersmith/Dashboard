import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Trash2,
  Upload,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Project, ProjectDocumentFile } from '../types';
import { formatCurrency } from '../utils/format';
import {
  totalPaymentOf,
  paymentReceivedOf,
  pendingAmountOf,
} from '../utils/analytics';
import {
  fetchProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
  projectDocumentUrl,
  type DocKind,
} from '../utils/api';
import { getToken } from '../utils/authStorage';

interface DocumentsWorkspaceProps {
  kind: DocKind;
  title: string;
  subtitle: string;
  docsColumnLabel: string;
  commentField: 'invoiceComment' | 'poComment';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsWorkspace({
  kind,
  title,
  subtitle,
  docsColumnLabel,
  commentField,
}: DocumentsWorkspaceProps) {
  const { data, updateProject, metrics } = useData();
  const [docsByProject, setDocsByProject] = useState<Record<number, ProjectDocumentFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const all = await fetchProjectDocuments(kind);
    const map: Record<number, ProjectDocumentFile[]> = {};
    for (const doc of all) {
      (map[doc.projectId] ??= []).push(doc);
    }
    setDocsByProject(map);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totals = useMemo(() => {
    const files = Object.values(docsByProject).reduce((n, list) => n + list.length, 0);
    return {
      files,
      received: metrics.totalPaymentsReceived,
      pending: metrics.totalPendings,
    };
  }, [docsByProject, metrics.totalPaymentsReceived, metrics.totalPendings]);

  const setBusyFlag = (projectId: number, on: boolean) => {
    setBusy((prev) => ({ ...prev, [projectId]: on }));
  };

  const openPdf = async (fileId: number, name: string) => {
    try {
      const res = await fetch(projectDocumentUrl(fileId), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Could not open file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert(`Could not open "${name}"`);
    }
  };

  const handleUpload = async (project: Project, fileList: FileList | null) => {
    if (!fileList?.length) return;
    setBusyFlag(project.id, true);
    let uploaded = 0;
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        alert(`Skipped "${file.name}" — only PDF files are allowed.`);
        continue;
      }
      const result = await uploadProjectDocument(kind, project.id, file);
      if (!result.ok) {
        alert(`Upload failed for "${file.name}": ${result.error}`);
        continue;
      }
      uploaded += 1;
      setDocsByProject((prev) => ({
        ...prev,
        [project.id]: [result.doc, ...(prev[project.id] ?? [])],
      }));
    }
    if (uploaded > 0) {
      // Mongo activity is recorded server-side in project_documents + activity collection
    }
    setBusyFlag(project.id, false);
    if (fileInputs.current[project.id]) fileInputs.current[project.id]!.value = '';
  };

  const handleDelete = async (project: Project, doc: ProjectDocumentFile) => {
    if (!confirm(`Delete "${doc.originalName}"?`)) return;
    setBusyFlag(project.id, true);
    const result = await deleteProjectDocument(doc.id);
    if (!result.ok) {
      alert(result.error);
      setBusyFlag(project.id, false);
      return;
    }
    setDocsByProject((prev) => ({
      ...prev,
      [project.id]: (prev[project.id] ?? []).filter((d) => d.id !== doc.id),
    }));
    // Mongo activity is recorded server-side
    setBusyFlag(project.id, false);
  };

  const saveComment = (project: Project, value: string) => {
    // Persists via PUT /api/data → Mongo projects + activity (field diff)
    updateProject({ ...project, [commentField]: value });
  };

  const savePaymentReceived = (project: Project, value: number) => {
    const paymentReceived = Math.max(0, value);
    // Persists via PUT /api/data → Mongo projects + activity (field diff)
    updateProject({ ...project, paymentReceived });
  };

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="inline-stats">
        <div className="inline-stat">
          <span>Projects</span>
          <strong>{data.projects.length}</strong>
        </div>
        <div className="inline-stat">
          <span>PDFs stored</span>
          <strong>{loading ? '…' : totals.files}</strong>
        </div>
        {kind === 'invoice' && (
          <>
            <div className="inline-stat">
              <span>Payments Received</span>
              <strong>{formatCurrency(totals.received)}</strong>
            </div>
            <div className="inline-stat">
              <span>Pending Amount</span>
              <strong>{formatCurrency(totals.pending)}</strong>
            </div>
          </>
        )}
      </div>

      <div className="panel table-panel editable-panel">
        <div className="table-wrap">
          <table className="editable-table docs-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Project Name</th>
                <th>Category</th>
                <th>Model</th>
                <th>Project Lead</th>
                {kind === 'invoice' && <th>Payment Received</th>}
                {kind === 'invoice' && <th>Pending</th>}
                <th>{docsColumnLabel}</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => {
                const docs = docsByProject[project.id] ?? [];
                const isOpen = expanded === project.id;
                const comment = String(project[commentField] ?? '');
                const received = paymentReceivedOf(project);
                const pending = pendingAmountOf(project);
                const totalPay = totalPaymentOf(project);

                return (
                  <tr key={project.id}>
                    <td>{project.company || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setExpanded(isOpen ? null : project.id)}
                        title="Show / hide PDF list"
                      >
                        {project.projectName || 'Untitled'}
                      </button>
                      <div className="muted-tiny">Total: {formatCurrency(totalPay)}</div>
                    </td>
                    <td>{project.category || '—'}</td>
                    <td>{project.model || '—'}</td>
                    <td>{project.projectLead || '—'}</td>

                    {kind === 'invoice' && (
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="no-spin payment-input"
                          defaultValue={received}
                          key={`pay-${project.id}-${received}`}
                          onBlur={(e) => {
                            const next = Math.max(0, Number(e.target.value) || 0);
                            if (next !== received) savePaymentReceived(project, next);
                          }}
                        />
                      </td>
                    )}
                    {kind === 'invoice' && (
                      <td className="tax-value-cell">{formatCurrency(pending)}</td>
                    )}

                    <td className="docs-cell">
                      <div className="docs-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy[project.id]}
                          onClick={() => fileInputs.current[project.id]?.click()}
                        >
                          {busy[project.id] ? <Loader2 size={14} className="spin-once" /> : <Upload size={14} />}
                          Upload PDF
                        </button>
                        <input
                          ref={(el) => { fileInputs.current[project.id] = el; }}
                          type="file"
                          accept="application/pdf,.pdf"
                          multiple
                          hidden
                          onChange={(e) => void handleUpload(project, e.target.files)}
                        />
                        <span className="docs-count">
                          <FileText size={13} /> {docs.length}
                        </span>
                      </div>

                      {(isOpen || docs.length > 0) && (
                        <ul className="docs-file-list">
                          {docs.length === 0 && isOpen && (
                            <li className="docs-empty">No PDFs uploaded yet</li>
                          )}
                          {docs.map((doc) => (
                            <li key={doc.id}>
                              <button
                                type="button"
                                className="docs-file-name"
                                onClick={() => void openPdf(doc.id, doc.originalName)}
                                title="Open PDF"
                              >
                                <ExternalLink size={12} />
                                {doc.originalName}
                              </button>
                              <span className="docs-meta">{formatBytes(doc.size)}</span>
                              <button
                                type="button"
                                className="icon-btn delete-btn"
                                disabled={busy[project.id]}
                                onClick={() => void handleDelete(project, doc)}
                                aria-label="Delete PDF"
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>

                    <td>
                      <textarea
                        className="comment-input"
                        rows={2}
                        placeholder="Add a comment…"
                        defaultValue={comment}
                        key={`${project.id}-${commentField}-${comment}`}
                        onBlur={(e) => {
                          if (e.target.value !== comment) {
                            saveComment(project, e.target.value);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
