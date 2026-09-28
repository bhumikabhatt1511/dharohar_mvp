/**
 * DHAROHAR REST API Client
 * 
 * Provides typed communication between the React frontend and the Express + PostGIS backend.
 * Integrates JWT authentication, role checks, validation, and resilient offline/local fallback.
 */

import { BackendHealthInfo, DocumentRecord, FieldInspectionRecord, LandParcel, UserProfile } from '../../types';

const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return `${envUrl.replace(/\/$/, '')}/api`;
    }
    // If running in production or behind reverse proxy
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}/api`;
    }
  }
  return 'http://localhost:3001/api';
};

const API_BASE = getApiBase();
const TOKEN_KEY = 'dharohar.jwt.token.v4';

/**
 * Get stored JWT access token from session storage
 */
export function getStoredAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Set or clear JWT access token
 */
export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

/**
 * Helper to build auth headers
 */
function getAuthHeaders(): HeadersInit {
  const token = getStoredAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// 1. Health check
export async function fetchBackendHealth(): Promise<BackendHealthInfo> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (!res.ok) throw new Error('Health check failed');
    const data = await res.json();
    return {
      status: 'connected',
      storageMode: data.storageMode || 'dev-fallback',
      postgisAvailable: Boolean(data.postgisAvailable),
      version: data.postgisVersion || undefined,
      database: data.database || undefined,
      uptimeSeconds: data.uptimeSeconds || 0,
      lastSync: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'dev-fallback',
      storageMode: 'dev-fallback',
      postgisAvailable: false,
      lastSync: new Date().toISOString(),
    };
  }
}

// 2. Authentication: Login
export async function loginToBackend(
  identifier: string,
  password?: string
): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password: password || 'Password@123' }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data?.token) {
      setStoredAuthToken(json.data.token);
      return json.data;
    }
    return null;
  } catch {
    return null;
  }
}

// 3. Authentication: Verify current session
export async function getMeFromBackend(): Promise<any | null> {
  try {
    const token = getStoredAuthToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data.user : null;
  } catch {
    return null;
  }
}

// 4. Parcels: List
export async function fetchParcelsFromBackend(filters?: {
  search?: string;
  filter?: string;
  status?: string;
}): Promise<{ storageMode: string; parcels: LandParcel[] } | null> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.filter) params.append('filter', filters.filter);
    if (filters?.status) params.append('status', filters.status);

    const url = `${API_BASE}/parcels${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.data?.parcels)) {
      return {
        storageMode: json.storageMode || 'dev-fallback',
        parcels: json.data.parcels,
      };
    }
    // Backward compatibility with legacy structure
    if (Array.isArray(json.parcels)) {
      return {
        storageMode: json.storageMode || 'dev-fallback',
        parcels: json.parcels,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 5. Parcels: Single
export async function fetchParcelById(id: string): Promise<LandParcel | null> {
  try {
    const res = await fetch(`${API_BASE}/parcels/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data.parcel : json.parcel || null;
  } catch {
    return null;
  }
}

// 6. Parcels: Create
export async function createParcelOnBackend(
  parcel: Partial<LandParcel>,
  performedBy = 'Officer'
): Promise<LandParcel | null> {
  try {
    const res = await fetch(`${API_BASE}/parcels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...parcel, performedBy }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data.parcel : json.parcel || null;
  } catch {
    return null;
  }
}

// 7. Parcels: Update
export async function updateParcelOnBackend(
  id: string,
  patch: Partial<LandParcel>,
  performedBy = 'Officer'
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/parcels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...patch, performedBy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 8. Parcels: Server Validation
export async function validateParcelOnBackend(id: string, validatedBy = 'Officer'): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/parcels/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ validatedBy }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

// 9. Parcels: Soft Delete / Archive
export async function archiveParcelOnBackend(
  id: string,
  reason: string,
  performedBy = 'Officer'
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/parcels/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason, performedBy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 10. Documents: List
export async function fetchDocumentsFromBackend(parcelId?: string): Promise<DocumentRecord[] | null> {
  try {
    const url = parcelId
      ? `${API_BASE}/documents?parcelId=${encodeURIComponent(parcelId)}`
      : `${API_BASE}/documents`;
    const res = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.data?.documents)) {
      return json.data.documents;
    }
    return null;
  } catch {
    return null;
  }
}

// 11. Documents: Single
export async function fetchDocumentByIdFromBackend(id: string): Promise<DocumentRecord | null> {
  try {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data.document : null;
  } catch {
    return null;
  }
}

// 12. Documents: Register / Upload
export async function uploadDocumentToBackend(
  doc: Partial<DocumentRecord>,
  performedBy = 'Verification Operator'
): Promise<DocumentRecord | null> {
  try {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...doc, uploadedBy: performedBy }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data.document : null;
  } catch {
    return null;
  }
}

// 13. Documents: Update Extraction / Metadata
export async function updateDocumentOnBackend(
  id: string,
  patch: Partial<DocumentRecord>,
  performedBy = 'Verification Officer'
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...patch, performedBy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 14. Field Inspection: Submit
export async function submitFieldInspectionToBackend(
  inspection: FieldInspectionRecord,
  officerBadge = 'OFFICER-DEMO'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/verifications/field-inspection`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...inspection, officerBadge }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message || 'Failed to submit inspection' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 15. Verification: Officer Digital Seal
export async function sealRecordOnBackend(payload: {
  parcelId?: string;
  documentId?: string;
  officerName: string;
  officerBadge: string;
  officerNotes: string;
  recordData?: any;
}): Promise<{ certificateNumber: string; signatureHash: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/verifications/seal`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : json;
  } catch {
    return null;
  }
}

// 16. Audit Logs: Fetch
export async function fetchAuditLogsFromBackend(parcelId?: string): Promise<any[]> {
  try {
    const url = parcelId
      ? `${API_BASE}/verifications/audit-logs?parcelId=${encodeURIComponent(parcelId)}`
      : `${API_BASE}/verifications/audit-logs`;
    const res = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success && Array.isArray(json.data?.auditLogs)
      ? json.data.auditLogs
      : Array.isArray(json.auditLogs)
      ? json.auditLogs
      : [];
  } catch {
    return [];
  }
}

// 17. Audit Chain: Cryptographic Verification
export async function verifyAuditChainOnBackend(): Promise<{ isValid: boolean; totalEntries: number; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/verifications/audit-logs/verify-chain`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { isValid: false, totalEntries: 0, message: 'Server unreachable' };
    const json = await res.json();
    return json.data || { isValid: false, totalEntries: 0, message: 'Invalid response' };
  } catch (err: any) {
    return { isValid: false, totalEntries: 0, message: err.message };
  }
}
