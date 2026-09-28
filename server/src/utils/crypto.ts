/**
 * DHAROHAR Cryptographic Utilities
 * Provides secure password hashing (PBKDF2), HMAC-SHA256 JWT tokens,
 * SHA-256 document hashing, and append-only audit log cryptographic chaining.
 */

import crypto from 'crypto';
import { AuthTokenPayload } from '../types/backend';

const JWT_SECRET = process.env.JWT_SECRET || 'dharohar_revenue_secret_key_sih2026_prototype_secure_token';
const JWT_EXPIRY_HOURS = 24;

/**
 * Hash a plain text password with a unique cryptographic salt using PBKDF2 (SHA-512)
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify a plain text password against stored hash and salt
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computed.hash, 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * Generate a standard HMAC-SHA256 signed JSON Web Token (JWT)
 */
export function createJwtToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_HOURS * 3600,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 signed JWT
 */
export function verifyJwtToken(token: string): AuthTokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as AuthTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate SHA-256 hash for document content, strings, or object payloads
 */
export function sha256(data: string | Buffer | object): string {
  const content = typeof data === 'object' && !Buffer.isBuffer(data)
    ? JSON.stringify(data)
    : data;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compute Chained Entry Hash for append-only audit trail
 */
export function computeAuditEntryHash(
  previousHash: string,
  entityId: string,
  actionType: string,
  performedBy: string,
  timestamp: string,
  details: any
): string {
  const detailsHash = sha256(details);
  const rawPayload = `${previousHash}:${entityId}:${actionType}:${performedBy}:${timestamp}:${detailsHash}`;
  return sha256(rawPayload);
}

/**
 * Genesis hash for the root of the audit chain
 */
export const GENESIS_AUDIT_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
