import type { AppData } from '../types';
import initialData from '../../data/initial-data.json';
import { authHeaders } from './authStorage';

const API_BASE = '/api';
const CACHE_KEY = 'mitkat-dashboard-cache';

export type ConnectionState = 'connecting' | 'online' | 'offline';

function cache(data: AppData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

function readCache(): AppData {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) return JSON.parse(stored) as AppData;
  } catch {
    /* ignore */
  }
  return initialData as AppData;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchData(): Promise<{ data: AppData; online: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/data`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as AppData;
    cache(data);
    return { data, online: true };
  } catch {
    return { data: readCache(), online: false };
  }
}

export async function saveData(data: AppData): Promise<boolean> {
  cache(data);
  try {
    const res = await fetch(`${API_BASE}/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resetData(): Promise<AppData> {
  try {
    const res = await fetch(`${API_BASE}/reset`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as AppData;
    cache(data);
    return data;
  } catch {
    const seed = initialData as AppData;
    cache(seed);
    return seed;
  }
}

export async function fetchCurrencyRate(
  fromCurrency: string,
): Promise<{ rate: number; updatedAt?: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/currency/rate/${fromCurrency}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rate: number; updatedAt?: string };
    return data;
  } catch {
    return null;
  }
}

export async function postActivity(payload: {
  message:     string;
  type:        string;
  who?:        string;
  action?:     string;
  entity?:     string;
  entityName?: string;
  changes?:    { field: string; from: string; to: string }[];
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
  } catch { /* best-effort, never crash the UI */ }
}

export async function fetchActivities(): Promise<unknown[]> {
  try {
    const res = await fetch(`${API_BASE}/activity`, { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as unknown[];
  } catch {
    return [];
  }
}

export type DocKind = 'invoice' | 'po';

export async function fetchProjectDocuments(
  kind: DocKind,
  projectId?: number,
): Promise<import('../types').ProjectDocumentFile[]> {
  try {
    const url =
      projectId != null
        ? `${API_BASE}/documents/${kind}/project/${projectId}`
        : `${API_BASE}/documents/${kind}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return [];
    return (await res.json()) as import('../types').ProjectDocumentFile[];
  } catch {
    return [];
  }
}

export async function uploadProjectDocument(
  kind: DocKind,
  projectId: number,
  file: File,
): Promise<{ ok: true; doc: import('../types').ProjectDocumentFile } | { ok: false; error: string }> {
  try {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`${API_BASE}/documents/${kind}/project/${projectId}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error || `HTTP ${res.status}` };
    }
    const doc = (await res.json()) as import('../types').ProjectDocumentFile;
    return { ok: true, doc };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed' };
  }
}

export async function deleteProjectDocument(
  fileId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/documents/file/${fileId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}

export function projectDocumentUrl(fileId: number): string {
  return `${API_BASE}/documents/file/${fileId}`;
}

export async function patchProjectBilling(
  projectId: number,
  patch: { paymentReceived?: number; invoiceComment?: string; poComment?: string },
): Promise<{ ok: true; project: import('../types').Project } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/documents/billing/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error || `HTTP ${res.status}` };
    }
    const project = (await res.json()) as import('../types').Project;
    return { ok: true, project };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' };
  }
}

export function nextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}
