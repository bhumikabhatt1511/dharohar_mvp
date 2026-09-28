import { Router, Request, Response } from 'express';
import { pool, getDbHealth, memoryStore } from '../db/db';
import { optionalAuth, authenticateToken, requireRole } from '../middleware/auth';
import { validateParcel, calculateGeodesicAreaHectares } from '../services/validationService';
import { recordAuditLog, getAuditLogs } from '../services/auditService';
import { sha256 } from '../utils/crypto';

export const parcelsRouter = Router();

// GET /api/parcels - List parcels with optional search and GIS validation filtering
parcelsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const includeArchived = req.query.includeArchived === 'true';
  const search = (req.query.search as string || '').toLowerCase().trim();
  const statusFilter = req.query.status as string;
  const filterType = req.query.filter as string; // 'all' | 'discrepancy' | 'verified' | 'needs_verification' | 'missing_data' | 'ownership_issue'
  const district = req.query.district as string;
  const village = req.query.village as string;

  const health = getDbHealth();

  let parcelsList: any[] = [];

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const query = includeArchived
          ? `SELECT p.*, ST_AsGeoJSON(p.geom) as geojson,
              COALESCE(json_agg(o.*) FILTER (WHERE o.id IS NOT NULL), '[]') as owners
             FROM parcels p
             LEFT JOIN parcel_owners o ON p.id = o.parcel_id
             GROUP BY p.id
             ORDER BY p.created_at DESC`
          : `SELECT p.*, ST_AsGeoJSON(p.geom) as geojson,
              COALESCE(json_agg(o.*) FILTER (WHERE o.id IS NOT NULL), '[]') as owners
             FROM parcels p
             LEFT JOIN parcel_owners o ON p.id = o.parcel_id
             WHERE p.is_archived = FALSE
             GROUP BY p.id
             ORDER BY p.created_at DESC`;

        const result = await client.query(query);
        parcelsList = result.rows.map((row) => {
          let boundary: Array<{ lat: number; lng: number }> = [];
          if (row.geojson) {
            try {
              const parsed = JSON.parse(row.geojson);
              if (parsed.coordinates && parsed.coordinates[0]) {
                boundary = parsed.coordinates[0].map((coord: [number, number]) => ({
                  lng: coord[0],
                  lat: coord[1],
                }));
              }
            } catch {}
          }
          return {
            id: row.id,
            khasraNo: row.khasra_no,
            khataNo: row.khata_no,
            khewatNo: row.khewat_no,
            patwarCircle: row.patwar_circle,
            district: row.district,
            tehsil: row.tehsil,
            village: row.village,
            mappedAreaHectares: Number(row.mapped_area_ha),
            recordedAreaHectares: row.recorded_area_ha ? Number(row.recorded_area_ha) : undefined,
            colour: row.colour,
            ownerName: row.owner_name,
            owners: row.owners || [],
            boundary,
            landType: row.land_type,
            inheritance: row.inheritance,
            documentId: row.document_id,
            documentName: row.document_name,
            documentType: row.document_type,
            documentUploadedAt: row.document_uploaded_at,
            documentDisplayId: row.document_display_id,
            documentUri: row.document_uri,
            status: row.status,
            ulpinStatus: row.ulpin_status || 'Pending Government Linkage',
            isArchived: row.is_archived,
            archivedAt: row.archived_at,
            archiveReason: row.archive_reason,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            verificationNotes: row.verification_notes,
            createdAt: row.created_at,
          };
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[PARCELS] PostgreSQL fetch error, falling back to memoryStore:', err.message);
    }
  }

  if (parcelsList.length === 0) {
    parcelsList = Array.from(memoryStore.parcels.values())
      .filter((p) => includeArchived || !p.isArchived)
      .map((p) => {
        const owners = memoryStore.owners.get(p.id) || p.owners || [];
        return {
          ...p,
          owners,
        };
      });
  }

  // Apply search query filter
  if (search) {
    parcelsList = parcelsList.filter((p) =>
      p.id.toLowerCase().includes(search) ||
      (p.khasraNo && p.khasraNo.toLowerCase().includes(search)) ||
      (p.khataNo && p.khataNo.toLowerCase().includes(search)) ||
      (p.ownerName && p.ownerName.toLowerCase().includes(search)) ||
      (p.village && p.village.toLowerCase().includes(search)) ||
      (p.district && p.district.toLowerCase().includes(search))
    );
  }

  // Apply status or special category filters
  if (statusFilter) {
    parcelsList = parcelsList.filter((p) => p.status === statusFilter);
  }

  if (filterType === 'discrepancy') {
    parcelsList = parcelsList.filter((p) => {
      const mapped = Number(p.mappedAreaHectares || 0);
      const recorded = Number(p.recordedAreaHectares || mapped);
      const delta = Math.abs(recorded - mapped);
      return delta > 0.02 || p.status === 'Needs Field Verification' || p.status === 'Needs Review';
    });
  } else if (filterType === 'verified') {
    parcelsList = parcelsList.filter((p) => p.status === 'Verified');
  } else if (filterType === 'needs_verification') {
    parcelsList = parcelsList.filter((p) => p.status === 'Needs Field Verification');
  } else if (filterType === 'ownership_issue') {
    parcelsList = parcelsList.filter((p) => {
      const owners = p.owners || [];
      const total = owners.reduce((acc: number, o: any) => acc + (Number(o.sharePercentage) || 0), 0);
      return Math.abs(total - 100.0) > 0.01;
    });
  }

  if (district) {
    parcelsList = parcelsList.filter((p) => p.district?.toLowerCase() === district.toLowerCase());
  }
  if (village) {
    parcelsList = parcelsList.filter((p) => p.village?.toLowerCase() === village.toLowerCase());
  }

  return res.json({
    success: true,
    total: parcelsList.length,
    parcels: parcelsList,
    data: {
      total: parcelsList.length,
      parcels: parcelsList,
    },
    storageMode: health.storageMode,
  });
});

// GET /api/parcels/:id - Get single parcel with related records
parcelsRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const health = getDbHealth();

  let parcel: any = null;
  let owners: any[] = [];
  let inspections: any[] = [];
  let auditHistory: any[] = [];

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT p.*, ST_AsGeoJSON(p.geom) as geojson,
            COALESCE(json_agg(o.*) FILTER (WHERE o.id IS NOT NULL), '[]') as owners
           FROM parcels p
           LEFT JOIN parcel_owners o ON p.id = o.parcel_id
           WHERE p.id = $1
           GROUP BY p.id`,
          [id]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          let boundary: Array<{ lat: number; lng: number }> = [];
          if (row.geojson) {
            try {
              const parsed = JSON.parse(row.geojson);
              if (parsed.coordinates && parsed.coordinates[0]) {
                boundary = parsed.coordinates[0].map((coord: [number, number]) => ({
                  lng: coord[0],
                  lat: coord[1],
                }));
              }
            } catch {}
          }

          parcel = {
            id: row.id,
            khasraNo: row.khasra_no,
            khataNo: row.khata_no,
            khewatNo: row.khewat_no,
            patwarCircle: row.patwar_circle,
            district: row.district,
            tehsil: row.tehsil,
            village: row.village,
            mappedAreaHectares: Number(row.mapped_area_ha),
            recordedAreaHectares: row.recorded_area_ha ? Number(row.recorded_area_ha) : undefined,
            colour: row.colour,
            ownerName: row.owner_name,
            owners: row.owners || [],
            boundary,
            landType: row.land_type,
            inheritance: row.inheritance,
            documentId: row.document_id,
            documentName: row.document_name,
            documentType: row.document_type,
            documentUploadedAt: row.document_uploaded_at,
            documentDisplayId: row.document_display_id,
            documentUri: row.document_uri,
            status: row.status,
            ulpinStatus: row.ulpin_status || 'Pending Government Linkage',
            isArchived: row.is_archived,
            archivedAt: row.archived_at,
            archiveReason: row.archive_reason,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            verificationNotes: row.verification_notes,
            createdAt: row.created_at,
          };
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[PARCELS] DB fetch single parcel error:', err.message);
    }
  }

  if (!parcel) {
    parcel = memoryStore.parcels.get(id);
    if (parcel) {
      owners = memoryStore.owners.get(id) || parcel.owners || [];
      parcel = { ...parcel, owners };
    }
  }

  if (!parcel) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PARCEL_NOT_FOUND',
        message: `Land parcel ${id} was not found in the spatial registry.`,
      },
    });
  }

  inspections = memoryStore.fieldInspections.get(id) || [];
  auditHistory = await getAuditLogs({ parcelId: id });

  return res.json({
    success: true,
    parcel: {
      ...parcel,
      inspections,
      auditHistory,
    },
    data: {
      parcel: {
        ...parcel,
        inspections,
        auditHistory,
      },
    },
    storageMode: health.storageMode,
  });
});

// POST /api/parcels - Create new parcel polygon record
parcelsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const body = req.body;
  if (!body.boundary || !Array.isArray(body.boundary) || body.boundary.length < 3) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BOUNDARY',
        message: 'A valid polygon boundary with at least 3 coordinate vertices is required.',
      },
    });
  }

  const performer = req.user?.displayName || body.performedBy || 'Revenue Officer';
  const badge = req.user?.badgeNumber || body.officerBadge || 'OFFICER-DEMO';

  const district = body.district || req.user?.district || 'Jaipur';
  const village = body.village || 'Rampur';
  const districtCode = district.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RJ';
  const villageCode = village.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'LAN';
  const id = body.id || `DH-${districtCode}-${villageCode}-${String(Date.now()).slice(-6)}`;

  const mappedAreaHectares = body.mappedAreaHectares ?? calculateGeodesicAreaHectares(body.boundary);
  const recordedAreaHectares = body.recordedAreaHectares ? Number(body.recordedAreaHectares) : undefined;
  const owners = Array.isArray(body.owners) && body.owners.length > 0 ? body.owners : [
    {
      id: `own-${Date.now()}`,
      name: body.ownerName || 'Unassigned',
      hindiName: body.ownerName || 'अनियत',
      relationType: 's/o',
      relativeName: 'Not recorded',
      relativeHindiName: 'उपलब्ध नहीं',
      shareFraction: '1/1',
      sharePercentage: 100.0,
      status: 'Active Co-sharer',
    }
  ];

  const newParcel = {
    id,
    khasraNo: body.khasraNo || '—',
    khataNo: body.khataNo || '—',
    khewatNo: body.khewatNo || '—',
    patwarCircle: body.patwarCircle || '—',
    district,
    tehsil: body.tehsil || 'Sanganer',
    village,
    mappedAreaHectares,
    recordedAreaHectares,
    colour: body.colour || '#2563eb',
    ownerName: owners[0]?.name || 'Unassigned',
    owners,
    boundary: body.boundary,
    landType: body.landType || 'Agricultural',
    inheritance: body.inheritance || 'Not recorded',
    mutationHistory: body.mutationHistory || [],
    documentId: body.documentId,
    documentName: body.documentName,
    documentType: body.documentType,
    documentUploadedAt: body.documentUploadedAt,
    documentDisplayId: body.documentDisplayId,
    documentUri: body.documentUri,
    status: body.status || 'Draft',
    ulpinStatus: 'Pending Government Linkage',
    isArchived: false,
    createdAt: new Date().toISOString(),
  };

  const health = getDbHealth();
  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const ring = [...newParcel.boundary, newParcel.boundary[0]]
          .map((pt: any) => `${pt.lng} ${pt.lat}`)
          .join(', ');
        const wkt = `POLYGON((${ring}))`;

        await client.query(
          `INSERT INTO parcels (
            id, khasra_no, khata_no, khewat_no, patwar_circle, district, tehsil, village,
            mapped_area_ha, recorded_area_ha, colour, owner_name, land_type,
            inheritance, document_id, document_name, document_type, document_uploaded_at,
            document_display_id, document_uri, status, ulpin_status, is_archived, geom, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, ST_GeomFromText($24, 4326), $25)`,
          [
            newParcel.id, newParcel.khasraNo, newParcel.khataNo, newParcel.khewatNo,
            newParcel.patwarCircle, newParcel.district, newParcel.tehsil, newParcel.village,
            newParcel.mappedAreaHectares, newParcel.recordedAreaHectares || null,
            newParcel.colour, newParcel.ownerName, newParcel.landType, newParcel.inheritance,
            newParcel.documentId || null, newParcel.documentName || null, newParcel.documentType || null,
            newParcel.documentUploadedAt || null, newParcel.documentDisplayId || null,
            newParcel.documentUri || null, newParcel.status, newParcel.ulpinStatus, false,
            wkt, newParcel.createdAt
          ]
        );

        for (const o of newParcel.owners) {
          await client.query(
            `INSERT INTO parcel_owners (
              id, parcel_id, name, hindi_name, relation_type, relative_name,
              relative_hindi_name, share_fraction, share_percentage, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              o.id || `own-${Date.now()}`, newParcel.id, o.name, o.hindiName || o.name,
              o.relationType || 's/o', o.relativeName || 'Not recorded',
              o.relativeHindiName || 'उपलब्ध नहीं', o.shareFraction || '1/1',
              o.sharePercentage || 100, o.status || 'Active Co-sharer'
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[PARCELS] DB insert parcel error:', err.message);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[PARCELS] Connection error:', err.message);
    }
  }

  // Save to memory store
  memoryStore.parcels.set(newParcel.id, newParcel);
  memoryStore.owners.set(newParcel.id, newParcel.owners);

  // Append-only cryptographic audit record
  await recordAuditLog({
    parcelId: newParcel.id,
    entityType: 'PARCEL',
    entityId: newParcel.id,
    actionType: 'PARCEL_CREATED',
    performedBy: performer,
    officerBadge: badge,
    details: {
      khasraNo: newParcel.khasraNo,
      village: newParcel.village,
      mappedAreaHa: newParcel.mappedAreaHectares,
    },
  });

  return res.status(201).json({
    success: true,
    parcel: newParcel,
    data: { parcel: newParcel },
    message: `Land parcel ${newParcel.id} registered successfully in the spatial registry.`,
  });
});

// PATCH & PUT /api/parcels/:id - Update parcel attributes
const updateParcelHandler = async (req: Request, res: Response) => {
  const { id } = req.params;
  const patch = req.body;
  const performer = req.user?.displayName || patch.performedBy || req.body.performedBy || 'Revenue Officer';
  const badge = req.user?.badgeNumber || patch.officerBadge || 'OFFICER-DEMO';

  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const checkRes = await client.query('SELECT * FROM parcels WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Parcel ${id} not found.` },
          });
        }

        const current = checkRes.rows[0];
        const khasraNo = patch.khasraNo ?? current.khasra_no;
        const khataNo = patch.khataNo ?? current.khata_no;
        const khewatNo = patch.khewatNo ?? current.khewat_no;
        const patwarCircle = patch.patwarCircle ?? current.patwar_circle;
        const district = patch.district ?? current.district;
        const tehsil = patch.tehsil ?? current.tehsil;
        const village = patch.village ?? current.village;
        const mappedAreaHectares = patch.mappedAreaHectares ?? Number(current.mapped_area_ha);
        const recordedAreaHectares = patch.recordedAreaHectares !== undefined
          ? (patch.recordedAreaHectares ? Number(patch.recordedAreaHectares) : null)
          : (current.recorded_area_ha ? Number(current.recorded_area_ha) : null);
        const status = patch.status ?? current.status;
        const verifiedBy = patch.verifiedBy !== undefined ? patch.verifiedBy : current.verified_by;
        const verifiedAt = patch.verifiedAt !== undefined ? patch.verifiedAt : current.verified_at;
        const verificationNotes = patch.verificationNotes !== undefined ? patch.verificationNotes : current.verification_notes;

        if (patch.boundary && Array.isArray(patch.boundary) && patch.boundary.length >= 3) {
          const ring = [...patch.boundary, patch.boundary[0]]
            .map((pt: any) => `${pt.lng} ${pt.lat}`)
            .join(', ');
          const wkt = `POLYGON((${ring}))`;

          await client.query(
            `UPDATE parcels SET
              khasra_no = $1, khata_no = $2, khewat_no = $3, patwar_circle = $4,
              district = $5, tehsil = $6, village = $7, mapped_area_ha = $8,
              recorded_area_ha = $9, status = $10, verified_by = $11, verified_at = $12,
              verification_notes = $13, geom = ST_GeomFromText($14, 4326), updated_at = NOW()
             WHERE id = $15`,
            [
              khasraNo, khataNo, khewatNo, patwarCircle, district, tehsil, village,
              mappedAreaHectares, recordedAreaHectares, status, verifiedBy, verifiedAt,
              verificationNotes, wkt, id
            ]
          );
        } else {
          await client.query(
            `UPDATE parcels SET
              khasra_no = $1, khata_no = $2, khewat_no = $3, patwar_circle = $4,
              district = $5, tehsil = $6, village = $7, mapped_area_ha = $8,
              recorded_area_ha = $9, status = $10, verified_by = $11, verified_at = $12,
              verification_notes = $13, updated_at = NOW()
             WHERE id = $14`,
            [
              khasraNo, khataNo, khewatNo, patwarCircle, district, tehsil, village,
              mappedAreaHectares, recordedAreaHectares, status, verifiedBy, verifiedAt,
              verificationNotes, id
            ]
          );
        }

        if (patch.owners && Array.isArray(patch.owners)) {
          await client.query('DELETE FROM parcel_owners WHERE parcel_id = $1', [id]);
          for (const o of patch.owners) {
            await client.query(
              `INSERT INTO parcel_owners (
                id, parcel_id, name, hindi_name, relation_type, relative_name,
                relative_hindi_name, share_fraction, share_percentage, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                o.id || `own-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                id, o.name, o.hindiName || o.name, o.relationType || 's/o',
                o.relativeName || 'Not recorded', o.relativeHindiName || 'उपलब्ध नहीं',
                o.shareFraction || '1/1', o.sharePercentage || 100, o.status || 'Active Co-sharer'
              ]
            );
          }
        }

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[PARCELS] DB update error:', err.message);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[PARCELS] Connection error:', err.message);
    }
  }

  // Update memory store
  const existing = memoryStore.parcels.get(id);
  const updated = {
    ...(existing || {}),
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.parcels.set(id, updated);
  if (patch.owners) {
    memoryStore.owners.set(id, patch.owners);
  }

  await recordAuditLog({
    parcelId: id,
    entityType: 'PARCEL',
    entityId: id,
    actionType: 'PARCEL_UPDATED',
    performedBy: performer,
    officerBadge: badge,
    details: patch,
  });

  return res.json({
    success: true,
    parcel: updated,
    data: { parcel: updated },
    message: `Parcel ${id} updated successfully.`,
  });
};

parcelsRouter.patch('/:id', optionalAuth, updateParcelHandler);
parcelsRouter.put('/:id', optionalAuth, updateParcelHandler);

// POST /api/parcels/:id/validate - Server-authoritative validation endpoint
parcelsRouter.post('/:id/validate', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const validator = req.user?.displayName || req.body.validatedBy || 'DHAROHAR Validation Engine';

  try {
    const result = await validateParcel(id, validator);

    await recordAuditLog({
      parcelId: id,
      entityType: 'PARCEL',
      entityId: id,
      actionType: 'VALIDATION_EXECUTED',
      performedBy: validator,
      officerBadge: req.user?.badgeNumber || 'SYS-VAL-01',
      details: {
        isValid: result.isValid,
        canBeVerified: result.canBeVerified,
        hasDiscrepancy: result.areaValidation.hasDiscrepancy,
        differenceHa: result.areaValidation.differenceHa,
        totalSharePercentage: result.ownershipValidation.totalSharePercentage,
      },
    });

    return res.json({
      success: true,
      data: result,
      message: `Validation completed for parcel ${id}.`,
    });
  } catch (err: any) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: err.message || 'Parcel validation failed.',
      },
    });
  }
});

// GET /api/parcels/:id/documents - Get documents associated with a parcel
parcelsRouter.get('/:id/documents', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM land_documents WHERE parcel_id = $1 ORDER BY uploaded_at DESC', [id]);
        return res.json({
          success: true,
          data: { documents: result.rows },
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[DOCS] Error querying PostgreSQL:', err.message);
    }
  }

  const docs = Array.from(memoryStore.documents.values()).filter((d) => d.parcelId === id);
  return res.json({
    success: true,
    data: { documents: docs },
  });
});

// POST /api/parcels/:id/documents - Link document to parcel
parcelsRouter.post('/:id/documents', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body;
  const docId = body.documentId || `doc-${Date.now()}`;
  const performer = req.user?.displayName || body.performedBy || 'Operator';

  const doc = {
    id: docId,
    parcelId: id,
    documentCode: body.documentCode || `DOC-${Date.now().toString().slice(-6)}`,
    fileName: body.fileName || 'Scanned_Land_Record.pdf',
    recordType: body.recordType || 'Jamabandi (RoR - Record of Rights)',
    ocrLanguage: body.ocrLanguage || 'hin+eng',
    rawOcrText: body.rawOcrText || '',
    extractedData: body.extractedData || {},
    documentHash: body.documentHash || sha256(body.fileName || 'doc'),
    uploadedBy: performer,
    uploadedAt: new Date().toISOString(),
  };

  memoryStore.documents.set(docId, doc);

  // Update parcel's document reference
  const parcel = memoryStore.parcels.get(id);
  if (parcel) {
    parcel.documentId = docId;
    parcel.documentName = doc.fileName;
    parcel.documentType = doc.recordType;
    memoryStore.parcels.set(id, parcel);
  }

  await recordAuditLog({
    parcelId: id,
    documentId: docId,
    entityType: 'DOCUMENT',
    entityId: docId,
    actionType: 'DOCUMENT_LINKED',
    performedBy: performer,
    officerBadge: req.user?.badgeNumber,
    details: { fileName: doc.fileName, recordType: doc.recordType },
  });

  return res.status(201).json({
    success: true,
    data: { document: doc },
    message: `Document ${doc.fileName} linked to parcel ${id}.`,
  });
});

// GET /api/parcels/:id/field-inspections - Get field inspections for parcel
parcelsRouter.get('/:id/field-inspections', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM field_inspections WHERE parcel_id = $1 ORDER BY created_at DESC', [id]);
        return res.json({
          success: true,
          data: { inspections: result.rows },
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[INSPECTION] Error querying PostgreSQL:', err.message);
    }
  }

  const list = memoryStore.fieldInspections.get(id) || [];
  return res.json({
    success: true,
    data: { inspections: list },
  });
});

// POST /api/parcels/:id/field-inspections - Submit assisted GPS/camera field inspection (RBAC protected)
parcelsRouter.post(
  '/:id/field-inspections',
  authenticateToken,
  requireRole('PATWARI', 'TEHSILDAR'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;
    const officer = req.user!;

    const inspectionId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const evidenceHash = sha256({
      parcelId: id,
      inspector: officer.displayName,
      badge: officer.badgeNumber,
      coords: body.gpsCoords,
      checkpoints: body.checkpoints,
      timestamp: new Date().toISOString(),
    });

    const inspection = {
      id: inspectionId,
      parcelId: id,
      inspectedAt: new Date().toISOString(),
      inspectedBy: officer.displayName,
      inspectorRole: officer.role === 'PATWARI' ? 'Patwari (Field Revenue Inspector)' : 'Tehsildar',
      gpsCoords: body.gpsCoords,
      deviceHeadingDeg: body.deviceHeadingDeg,
      checkpoints: body.checkpoints || [],
      discrepancyObserved: Boolean(body.discrepancyObserved),
      discrepancyNotes: body.discrepancyNotes || '',
      observedLandUse: body.observedLandUse || 'Agricultural',
      photoUri: body.photoUri,
      photoTimestamp: body.photoTimestamp || (body.photoUri ? new Date().toISOString() : undefined),
      evidenceHash,
      isProvisional: true,
      recommendedAction: body.recommendedAction || 'Proceed to Officer Seal',
      createdAt: new Date().toISOString(),
    };

    const currentList = memoryStore.fieldInspections.get(id) || [];
    currentList.push(inspection);
    memoryStore.fieldInspections.set(id, currentList);

    await recordAuditLog({
      parcelId: id,
      entityType: 'FIELD_INSPECTION',
      entityId: inspectionId,
      actionType: 'FIELD_INSPECTION_SUBMITTED',
      performedBy: officer.displayName,
      officerBadge: officer.badgeNumber,
      details: {
        inspectionId,
        discrepancyObserved: inspection.discrepancyObserved,
        evidenceHash,
        checkpointsCount: inspection.checkpoints.length,
      },
    });

    return res.status(201).json({
      success: true,
      data: { inspection },
      message: 'Field inspection submitted and registered in audit trail.',
    });
  }
);

// POST /api/parcels/:id/verify - Official Officer Verification & Digital Sealing (RBAC protected: TEHSILDAR ONLY)
parcelsRouter.post(
  '/:id/verify',
  authenticateToken,
  requireRole('TEHSILDAR'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;
    const officer = req.user!;

    // Perform validation check first
    try {
      const valResult = await validateParcel(id, officer.displayName);
      if (!valResult.canBeVerified && !body.forceOverride) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VERIFICATION_PRECONDITIONS_FAILED',
            message: 'Parcel cannot be sealed: prerequisite cadastral or ownership checks are pending.',
            details: valResult,
          },
        });
      }

      const certificateNumber = `CERT-DHR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const signatureHash = sha256(`${id}:${officer.displayName}:${officer.badgeNumber}:${certificateNumber}:${Date.now()}`);

      // Update parcel status
      const parcel = memoryStore.parcels.get(id);
      if (parcel) {
        parcel.status = 'Verified';
        parcel.verifiedBy = `${officer.displayName} (${officer.designation || officer.role})`;
        parcel.verifiedAt = new Date().toISOString();
        parcel.verificationNotes = body.officerNotes || 'Verified against Master Shajra Cadastre.';
        memoryStore.parcels.set(id, parcel);
      }

      // Record append-only audit log
      await recordAuditLog({
        parcelId: id,
        entityType: 'VERIFICATION_SEAL',
        entityId: id,
        actionType: 'RECORD_SEALED',
        performedBy: officer.displayName,
        officerBadge: officer.badgeNumber,
        signatureHash,
        details: {
          certificateNumber,
          notes: body.officerNotes || 'Verified against Master Shajra Cadastre.',
          sealedBy: officer.displayName,
          sealedAt: new Date().toISOString(),
        },
      });

      return res.json({
        success: true,
        data: {
          certificateNumber,
          signatureHash,
          sealedAt: new Date().toISOString(),
          parcel: memoryStore.parcels.get(id),
        },
        message: 'Land parcel authenticated and sealed by revenue authority.',
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_ERROR', message: err.message },
      });
    }
  }
);

// GET /api/parcels/:id/audit - Get chronological audit trail for parcel
parcelsRouter.get('/:id/audit', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = await getAuditLogs({ parcelId: id });

  return res.json({
    success: true,
    data: {
      total: logs.length,
      auditLogs: logs,
    },
  });
});

// DELETE /api/parcels/:id - Soft-delete / Archive ONLY (No hard delete permitted)
parcelsRouter.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const reason = req.body?.reason || (req.query.reason as string) || 'Archived by revenue officer.';
  const performer = req.user?.displayName || req.body?.performedBy || 'Revenue Officer';
  const badge = req.user?.badgeNumber || 'OFFICER-DEMO';

  const health = getDbHealth();
  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE parcels SET
            is_archived = TRUE,
            status = 'Archived',
            archived_at = NOW(),
            archive_reason = $1
           WHERE id = $2`,
          [reason, id]
        );
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[PARCELS] DB archive error:', err.message);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[PARCELS] Connection error:', err.message);
    }
  }

  const parcel = memoryStore.parcels.get(id);
  if (parcel) {
    parcel.isArchived = true;
    parcel.status = 'Archived';
    parcel.archivedAt = new Date().toISOString();
    parcel.archiveReason = reason;
    memoryStore.parcels.set(id, parcel);
  }

  await recordAuditLog({
    parcelId: id,
    entityType: 'PARCEL',
    entityId: id,
    actionType: 'PARCEL_ARCHIVED',
    performedBy: performer,
    officerBadge: badge,
    details: { reason },
  });

  return res.json({
    success: true,
    id,
    isArchived: true,
    data: { id, isArchived: true },
    message: `Parcel ${id} soft-deleted (archived). Historical state retained in append-only audit trail.`,
  });
});
