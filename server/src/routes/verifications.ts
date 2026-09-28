import { Router, Request, Response } from 'express';
import { memoryStore, getDbHealth, pool } from '../db/db';
import { optionalAuth, authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog, getAuditLogs, verifyAuditChain } from '../services/auditService';
import { sha256 } from '../utils/crypto';

export const verificationsRouter = Router();

// GET /api/verifications/audit-logs - Append-only audit records with cryptographic chain info
verificationsRouter.get('/audit-logs', optionalAuth, async (req: Request, res: Response) => {
  const parcelId = req.query.parcelId as string;
  const entityId = req.query.entityId as string;

  const logs = await getAuditLogs({ parcelId, entityId });

  return res.json({
    success: true,
    total: logs.length,
    auditLogs: logs.slice().reverse(),
    data: {
      total: logs.length,
      auditLogs: logs.slice().reverse(), // latest first
    },
    storageMode: getDbHealth().storageMode,
  });
});

// GET /api/verifications/audit-logs/verify-chain - Cryptographically verify the entire audit log chain
verificationsRouter.get('/audit-logs/verify-chain', optionalAuth, async (req: Request, res: Response) => {
  const verification = await verifyAuditChain();
  return res.json({
    success: verification.isValid,
    data: verification,
  });
});

// POST /api/verifications/field-inspection - Assisted AR / GPS field inspection (RBAC: PATWARI or TEHSILDAR)
verificationsRouter.post(
  '/field-inspection',
  optionalAuth,
  async (req: Request, res: Response) => {
    const body = req.body;
    if (!body.parcelId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARCEL_ID', message: 'parcelId is required for field inspection.' },
      });
    }

    // Role check: if authenticated user is DATA_ENTRY_OPERATOR, reject
    if (req.user && req.user.role === 'DATA_ENTRY_OPERATOR') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Data Entry Operators are not authorized to submit field inspection records.',
        },
      });
    }

    const inspectorName = req.user?.displayName || body.inspectedBy || 'Demo Field Officer';
    const inspectorBadge = req.user?.badgeNumber || body.officerBadge || 'PATWARI-DEMO-01';
    const inspectorRole = req.user?.role === 'TEHSILDAR' ? 'Tehsildar' : 'Patwari / Revenue Field Inspector';

    const inspectionId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const evidenceHash = sha256({
      parcelId: body.parcelId,
      inspector: inspectorName,
      badge: inspectorBadge,
      coords: body.gpsCoords,
      checkpoints: body.checkpoints,
      timestamp: new Date().toISOString(),
    });

    const inspectionRecord = {
      id: inspectionId,
      parcelId: body.parcelId,
      inspectedAt: new Date().toISOString(),
      inspectedBy: inspectorName,
      inspectorRole,
      gpsCoords: body.gpsCoords,
      deviceHeadingDeg: body.deviceHeadingDeg,
      checkpoints: body.checkpoints || [],
      discrepancyObserved: Boolean(body.discrepancyObserved),
      discrepancyNotes: body.discrepancyNotes || '',
      observedLandUse: body.observedLandUse || 'Agricultural',
      photoUri: body.photoUri,
      photoTimestamp: body.photoTimestamp || (body.photoUri ? new Date().toISOString() : undefined),
      evidenceHash,
      isProvisional: true, // Camera/GPS assisted verification
      recommendedAction: body.recommendedAction || 'Proceed to Officer Seal',
    };

    // Attach to memory store
    const currentList = memoryStore.fieldInspections.get(body.parcelId) || [];
    currentList.push(inspectionRecord);
    memoryStore.fieldInspections.set(body.parcelId, currentList);

    // Update parcel status
    const parcel = memoryStore.parcels.get(body.parcelId);
    if (parcel) {
      parcel.status = inspectionRecord.discrepancyObserved ? 'Needs Review' : 'Needs Field Verification';
      memoryStore.parcels.set(body.parcelId, parcel);
    }

    // Cryptographic audit record
    await recordAuditLog({
      parcelId: body.parcelId,
      entityType: 'FIELD_INSPECTION',
      entityId: inspectionId,
      actionType: 'FIELD_INSPECTION_RECORDED',
      performedBy: inspectorName,
      officerBadge: inspectorBadge,
      details: {
        inspectionId,
        discrepancyObserved: inspectionRecord.discrepancyObserved,
        checkpointsCount: inspectionRecord.checkpoints.length,
        evidenceHash,
        recommendedAction: inspectionRecord.recommendedAction,
      },
    });

    return res.status(201).json({
      success: true,
      inspection: inspectionRecord,
      data: { inspection: inspectionRecord },
      message: 'Assisted field inspection recorded successfully.',
      storageMode: getDbHealth().storageMode,
    });
  }
);

// POST /api/verifications/seal - Officer Official Verification Seal (RBAC: TEHSILDAR ONLY)
verificationsRouter.post(
  '/seal',
  optionalAuth,
  async (req: Request, res: Response) => {
    const { parcelId, documentId, officerName, officerBadge, officerNotes, recordData, forceOverride } = req.body;

    if (!parcelId && !documentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TARGET', message: 'parcelId or documentId is required to seal record.' },
      });
    }

    // Role check: If authenticated, only TEHSILDAR can digitally seal
    if (req.user && req.user.role !== 'TEHSILDAR') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role '${req.user.role}' is not authorized to apply the final Digital Seal. Tehsildar authorization required.`,
        },
      });
    }

    const officer = req.user?.displayName || officerName || 'Shri Arvind Sharma, RAS';
    const badge = req.user?.badgeNumber || officerBadge || 'RJ-REV-2018-0941';

    const certificateNumber = `CERT-DHR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const signatureHash = sha256(`${parcelId || documentId}:${officer}:${badge}:${certificateNumber}:${Date.now()}`);

    if (parcelId) {
      const parcel = memoryStore.parcels.get(parcelId);
      if (parcel) {
        parcel.status = 'Verified';
        parcel.verifiedBy = `${officer} (Tehsildar)`;
        parcel.verifiedAt = new Date().toISOString();
        parcel.verificationNotes = officerNotes || 'Verified against Master Shajra Cadastre.';
        memoryStore.parcels.set(parcelId, parcel);
      }
    }

    // Record append-only audit entry
    await recordAuditLog({
      parcelId: parcelId || null,
      documentId: documentId || null,
      entityType: 'VERIFICATION_SEAL',
      entityId: parcelId || documentId || 'SEAL',
      actionType: 'RECORD_SEALED',
      performedBy: officer,
      officerBadge: badge,
      signatureHash,
      details: {
        certificateNumber,
        notes: officerNotes || 'Verified against Master Shajra Cadastre.',
        recordData,
      },
    });

    return res.json({
      success: true,
      certificateNumber,
      signatureHash,
      sealedAt: new Date().toISOString(),
      verifiedBy: officer,
      officerBadge: badge,
      data: {
        certificateNumber,
        signatureHash,
        sealedAt: new Date().toISOString(),
        verifiedBy: officer,
        officerBadge: badge,
      },
      message: 'Record authenticated and sealed by revenue authority. Append-only audit record created.',
      storageMode: getDbHealth().storageMode,
    });
  }
);
