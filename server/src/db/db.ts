import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import { UserAccount, AuditLogEntry } from '../types/backend';
import { hashPassword, GENESIS_AUDIT_HASH } from '../utils/crypto';

dotenv.config();

export type StorageMode = 'postgres-postgis' | 'dev-fallback';

export interface DbHealth {
  connected: boolean;
  storageMode: StorageMode;
  postgisAvailable: boolean;
  postgisVersion?: string;
  database?: string;
  error?: string;
  uptimeSeconds: number;
}

const startTime = Date.now();
let activeStorageMode: StorageMode = 'dev-fallback';
let postgisAvailable = false;
let postgisVersionString = '';
let connectionError: string | undefined = undefined;

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.PGUSER &&
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD || ''}@${
      process.env.PGHOST || 'localhost'
    }:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'dharohar_db'}`);

export const pool = new Pool(
  connectionString
    ? { connectionString, connectionTimeoutMillis: 3000 }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'dharohar_db',
        connectionTimeoutMillis: 3000,
      }
);

// Pre-seeded demo user accounts with cryptographic salts & PBKDF2 hashes
const defaultSalt = 'dharohar_salt_demo_2026';
const defaultPassword = 'Password@123';
const defaultHash = hashPassword(defaultPassword, defaultSalt).hash;

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'USR-TEH-01',
    email: 'tehsildar@dharohar.local',
    passwordHash: defaultHash,
    salt: defaultSalt,
    role: 'TEHSILDAR',
    displayName: 'Shri Arvind Sharma, RAS',
    designation: 'Revenue Officer / Tehsildar',
    badgeNumber: 'RJ-REV-2018-0941',
    jurisdiction: 'Tehsil Sanganer, Circle Jaipur South',
    district: 'Jaipur',
    state: 'Rajasthan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'USR-VER-02',
    email: 'patwari@dharohar.local',
    passwordHash: defaultHash,
    salt: defaultSalt,
    role: 'PATWARI',
    displayName: 'Smt. Sunita Choudhary',
    designation: 'Senior Verification Officer',
    badgeNumber: 'RJ-REV-2021-3812',
    jurisdiction: 'Central Digitization Center, Jodhpur',
    district: 'Jodhpur',
    state: 'Rajasthan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'USR-OPR-03',
    email: 'operator@dharohar.local',
    passwordHash: defaultHash,
    salt: defaultSalt,
    role: 'DATA_ENTRY_OPERATOR',
    displayName: 'Vikram Singh Rathore',
    designation: 'Verification Operator',
    badgeNumber: 'RJ-OPS-2023-1109',
    jurisdiction: 'Tehsil Girwa Record Room',
    district: 'Udaipur',
    state: 'Rajasthan',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'USR-AUD-04',
    email: 'auditor@dharohar.local',
    passwordHash: defaultHash,
    salt: defaultSalt,
    role: 'AUDITOR',
    displayName: 'Dr. Meenakshi Sundaram, IAS',
    designation: 'State Land Records Auditor',
    badgeNumber: 'RJ-AUDIT-2015-0012',
    jurisdiction: 'Board of Revenue for Rajasthan, Ajmer',
    district: 'Ajmer',
    state: 'Rajasthan',
    createdAt: new Date().toISOString(),
  },
];

// Fallback in-memory store for development/demo when PostgreSQL is not configured
export const memoryStore = {
  users: new Map<string, UserAccount>(INITIAL_USERS.map((u) => [u.id, u])),
  parcels: new Map<string, any>(),
  owners: new Map<string, any[]>(),
  mutations: new Map<string, any[]>(),
  documents: new Map<string, any>(),
  fieldInspections: new Map<string, any[]>(),
  auditLogs: [] as AuditLogEntry[],
};

export async function initDbConnection(): Promise<DbHealth> {
  try {
    const client = await pool.connect();
    try {
      // Test PostGIS extension
      const postgisCheck = await client.query('SELECT PostGIS_Version();').catch(() => null);
      if (postgisCheck && postgisCheck.rows.length > 0) {
        postgisAvailable = true;
        postgisVersionString = postgisCheck.rows[0].postgis_version || 'Enabled';
      }

      activeStorageMode = 'postgres-postgis';
      connectionError = undefined;
      console.log(
        `[DHAROHAR DB] Connected to PostgreSQL. PostGIS: ${
          postgisAvailable ? postgisVersionString : 'Not detected'
        }`
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    activeStorageMode = 'dev-fallback';
    connectionError = err.message || 'Database connection error';
    console.warn(`[DHAROHAR DB] NOTICE: Running in EXPLICIT DEV-FALLBACK mode.`);
    console.warn(`[DHAROHAR DB] In-memory storage is active for local testing and demonstration.`);
  }

  return getDbHealth();
}

export function getDbHealth(): DbHealth {
  return {
    connected: activeStorageMode === 'postgres-postgis',
    storageMode: activeStorageMode,
    postgisAvailable,
    postgisVersion: postgisVersionString || undefined,
    database: process.env.PGDATABASE || 'dharohar_db',
    error: connectionError,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  };
}

export async function dbQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  if (activeStorageMode === 'postgres-postgis') {
    return pool.query<T>(text, params);
  }
  throw new Error('PostgreSQL not connected; use store adapter in dev-fallback mode.');
}
