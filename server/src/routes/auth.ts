import { Router, Request, Response } from 'express';
import { memoryStore, getDbHealth, pool, INITIAL_USERS } from '../db/db';
import { verifyPassword, createJwtToken } from '../utils/crypto';
import { authenticateToken } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';

export const authRouter = Router();

// POST /api/auth/login - Authenticate officer and return JWT access token
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, username, officerId, profileId, password } = req.body;
  const loginIdentifier = (email || username || officerId || profileId || '').toLowerCase().trim();

  let user: any = null;
  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT * FROM users WHERE LOWER(email) = $1 OR id = $2 OR LOWER(badge_number) = $1 LIMIT 1',
          [loginIdentifier, loginIdentifier.toUpperCase()]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          user = {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            salt: row.salt,
            role: row.role,
            displayName: row.display_name,
            designation: row.designation,
            badgeNumber: row.badge_number,
            jurisdiction: row.jurisdiction,
            district: row.district,
            state: row.state,
          };
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[AUTH] DB fetch error:', err.message);
    }
  }

  if (!user) {
    // Check in-memory store
    const allUsers = Array.from(memoryStore.users.values());
    user = allUsers.find(
      (u) =>
        u.email.toLowerCase() === loginIdentifier ||
        u.id.toLowerCase() === loginIdentifier ||
        u.badgeNumber.toLowerCase() === loginIdentifier ||
        u.displayName.toLowerCase().replace(/[^a-z]/g, '') === loginIdentifier.replace(/[^a-z]/g, '')
    );
  }

  // Fallback to primary persona if no identifier specified in demo
  if (!user && !loginIdentifier) {
    user = INITIAL_USERS[0];
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid officer identifier or password.',
      },
    });
  }

  // Verify password if provided
  const inputPassword = password || 'Password@123';
  const isPasswordValid = verifyPassword(inputPassword, user.passwordHash, user.salt);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid password. Please check your credentials.',
      },
    });
  }

  // Create JWT token
  const token = createJwtToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    designation: user.designation,
    badgeNumber: user.badgeNumber,
    district: user.district,
  });

  // Record audit log for login
  await recordAuditLog({
    entityType: 'SYSTEM',
    entityId: user.id,
    actionType: 'OFFICER_LOGGED_IN',
    performedBy: user.displayName,
    officerBadge: user.badgeNumber,
    details: {
      role: user.role,
      district: user.district,
      designation: user.designation,
    },
  });

  return res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        designation: user.designation,
        badgeNumber: user.badgeNumber,
        jurisdiction: user.jurisdiction,
        district: user.district,
        state: user.state,
      },
    },
    message: `Authentication successful. Welcome, ${user.displayName}.`,
  });
});

// GET /api/auth/me - Get current authenticated officer profile
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  const tokenUser = req.user!;
  let userProfile = memoryStore.users.get(tokenUser.userId);

  if (!userProfile) {
    userProfile = INITIAL_USERS.find((u) => u.id === tokenUser.userId || u.email === tokenUser.email);
  }

  return res.json({
    success: true,
    data: {
      user: {
        id: tokenUser.userId,
        email: tokenUser.email,
        role: tokenUser.role,
        displayName: tokenUser.displayName,
        badgeNumber: tokenUser.badgeNumber,
        district: tokenUser.district,
        designation: userProfile?.designation || tokenUser.role,
        jurisdiction: userProfile?.jurisdiction || `${tokenUser.district} District`,
        state: userProfile?.state || 'Rajasthan',
      },
    },
  });
});

// GET /api/auth/users - List available demo personas (no password hashes exposed)
authRouter.get('/users', (req: Request, res: Response) => {
  const users = Array.from(memoryStore.users.values()).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.displayName,
    designation: u.designation,
    badgeNumber: u.badgeNumber,
    jurisdiction: u.jurisdiction,
    district: u.district,
    state: u.state,
  }));

  return res.json({
    success: true,
    data: { users },
  });
});
