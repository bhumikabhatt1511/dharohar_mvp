/**
 * DHAROHAR Append-Only Cryptographic Audit Service
 * 
 * Provides verifiable tamper-evident event logging using cryptographic SHA-256 hash chaining.
 * Every state change generates an entry where entry_hash = SHA256(previous_hash + payload).
 */

import { pool, getDbHealth, memoryStore } from '../db/db';
import { computeAuditEntryHash, GENESIS_AUDIT_HASH, sha256 } from '../utils/crypto';
import { AuditLogEntry } from '../types/backend';

export interface CreateAuditLogParams {
  parcelId?: string | null;
  documentId?: string | null;
  entityType?: 'PARCEL' | 'DOCUMENT' | 'FIELD_INSPECTION' | 'VERIFICATION_SEAL' | 'SYSTEM';
  entityId?: string;
  actionType: string;
  performedBy: string;
  officerBadge?: string;
  details?: Record<string, any>;
  signatureHash?: string;
  createdAt?: string;
}

/**
 * Record a new append-only audit entry with cryptographic hash chaining
 */
export async function recordAuditLog(params: CreateAuditLogParams): Promise<AuditLogEntry> {
  const timestamp = params.createdAt || new Date().toISOString();
  const entityType = params.entityType || 'PARCEL';
  const entityId = params.entityId || params.parcelId || params.documentId || 'SYSTEM';
  const details = params.details || {};

  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Fetch previous entry hash
        const lastRowRes = await client.query(
          'SELECT entry_hash FROM append_only_audit_logs ORDER BY id DESC LIMIT 1'
        );
        const previousHash = lastRowRes.rows.length > 0 && lastRowRes.rows[0].entry_hash
          ? lastRowRes.rows[0].entry_hash
          : GENESIS_AUDIT_HASH;

        const entryHash = computeAuditEntryHash(
          previousHash,
          entityId,
          params.actionType,
          params.performedBy,
          timestamp,
          details
        );

        const insertRes = await client.query(
          `INSERT INTO append_only_audit_logs (
            parcel_id, document_id, entity_type, entity_id, action_type,
            performed_by, officer_badge, details, previous_hash, entry_hash,
            signature_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`,
          [
            params.parcelId || null,
            params.documentId || null,
            entityType,
            entityId,
            params.actionType,
            params.performedBy,
            params.officerBadge || null,
            JSON.stringify(details),
            previousHash,
            entryHash,
            params.signatureHash || null,
            timestamp,
          ]
        );

        await client.query('COMMIT');

        const newEntry: AuditLogEntry = {
          id: insertRes.rows[0].id,
          parcelId: params.parcelId,
          documentId: params.documentId,
          entityType,
          entityId,
          actionType: params.actionType,
          performedBy: params.performedBy,
          officerBadge: params.officerBadge,
          details,
          previousHash,
          entryHash,
          signatureHash: params.signatureHash,
          createdAt: timestamp,
        };

        // Also sync to memoryStore
        memoryStore.auditLogs.push(newEntry);
        return newEntry;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[AUDIT SERVICE] DB insert error, falling back to memoryStore:', err.message);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[AUDIT SERVICE] DB connection error:', err.message);
    }
  }

  // In-memory store fallback with hash chaining
  const lastLog = memoryStore.auditLogs.length > 0
    ? memoryStore.auditLogs[memoryStore.auditLogs.length - 1]
    : null;
  const previousHash = lastLog && lastLog.entryHash ? lastLog.entryHash : GENESIS_AUDIT_HASH;

  const entryHash = computeAuditEntryHash(
    previousHash,
    entityId,
    params.actionType,
    params.performedBy,
    timestamp,
    details
  );

  const entry: AuditLogEntry = {
    id: memoryStore.auditLogs.length + 1,
    parcelId: params.parcelId || null,
    documentId: params.documentId || null,
    entityType,
    entityId,
    actionType: params.actionType,
    performedBy: params.performedBy,
    officerBadge: params.officerBadge || undefined,
    details,
    previousHash,
    entryHash,
    signatureHash: params.signatureHash || undefined,
    createdAt: timestamp,
  };

  memoryStore.auditLogs.push(entry);
  return entry;
}

/**
 * Fetch chronological audit logs for a parcel or all entities
 */
export async function getAuditLogs(filter?: { parcelId?: string; entityId?: string }): Promise<AuditLogEntry[]> {
  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        let query = 'SELECT * FROM append_only_audit_logs';
        const params: any[] = [];

        if (filter?.parcelId) {
          query += ' WHERE parcel_id = $1 OR entity_id = $1';
          params.push(filter.parcelId);
        } else if (filter?.entityId) {
          query += ' WHERE entity_id = $1';
          params.push(filter.entityId);
        }

        query += ' ORDER BY id ASC';
        const result = await client.query(query, params);

        return result.rows.map((row) => ({
          id: row.id,
          parcelId: row.parcel_id,
          documentId: row.document_id,
          entityType: row.entity_type || 'PARCEL',
          entityId: row.entity_id || row.parcel_id || 'SYSTEM',
          actionType: row.action_type,
          performedBy: row.performed_by,
          officerBadge: row.officer_badge,
          details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {},
          previousHash: row.previous_hash,
          entryHash: row.entry_hash,
          signatureHash: row.signature_hash,
          createdAt: row.created_at,
        }));
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[AUDIT SERVICE] DB fetch error:', err.message);
    }
  }

  let logs = [...memoryStore.auditLogs];
  if (filter?.parcelId) {
    logs = logs.filter((l) => l.parcelId === filter.parcelId || l.entityId === filter.parcelId);
  } else if (filter?.entityId) {
    logs = logs.filter((l) => l.entityId === filter.entityId);
  }

  return logs;
}

/**
 * Verify cryptographic integrity of the audit chain
 */
export async function verifyAuditChain(): Promise<{
  isValid: boolean;
  totalEntries: number;
  brokenLinkIndex?: number;
  message: string;
}> {
  const logs = await getAuditLogs();
  if (logs.length === 0) {
    return { isValid: true, totalEntries: 0, message: 'Audit chain is empty.' };
  }

  let currentExpectedPrevious = GENESIS_AUDIT_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];
    if (entry.previousHash !== currentExpectedPrevious) {
      return {
        isValid: false,
        totalEntries: logs.length,
        brokenLinkIndex: i,
        message: `Broken chain link at index ${i}: expected previousHash ${currentExpectedPrevious}, got ${entry.previousHash}`,
      };
    }

    const recomputedHash = computeAuditEntryHash(
      entry.previousHash,
      entry.entityId || entry.parcelId || 'SYSTEM',
      entry.actionType,
      entry.performedBy,
      entry.createdAt,
      entry.details
    );

    if (entry.entryHash !== recomputedHash) {
      return {
        isValid: false,
        totalEntries: logs.length,
        brokenLinkIndex: i,
        message: `Tampered payload hash at index ${i}: stored ${entry.entryHash}, computed ${recomputedHash}`,
      };
    }

    currentExpectedPrevious = entry.entryHash;
  }

  return {
    isValid: true,
    totalEntries: logs.length,
    message: `Audit chain verified successfully. ${logs.length} entries cryptographically sealed with SHA-256.`,
  };
}
