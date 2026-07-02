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

export function nextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}
