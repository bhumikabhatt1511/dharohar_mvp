import { Router, Request, Response } from 'express';
import { memoryStore, getDbHealth, pool } from '../db/db';
import { optionalAuth } from '../middleware/auth';
import { recordAuditLog } from '../services/auditService';
import { sha256 } from '../utils/crypto';

export const documentsRouter = Router();

// GET /api/documents - List all registered document records
documentsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const health = getDbHealth();
  const parcelId = req.query.parcelId as string;

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const query = parcelId
          ? 'SELECT * FROM land_documents WHERE parcel_id = $1 ORDER BY uploaded_at DESC'
          : 'SELECT * FROM land_documents ORDER BY uploaded_at DESC';
        const params = parcelId ? [parcelId] : [];
        const result = await client.query(query, params);
        return res.json({
          success: true,
          data: {
            total: result.rows.length,
            documents: result.rows,
          },
          storageMode: health.storageMode,
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[DOCUMENTS] PostgreSQL fetch error:', err.message);
    }
  }

  let documents = Array.from(memoryStore.documents.values());
  if (parcelId) {
    documents = documents.filter((d) => d.parcelId === parcelId);
  }

  return res.json({
    success: true,
    data: {
      total: documents.length,
      documents,
    },
    storageMode: health.storageMode,
  });
});

// GET /api/documents/:id - Get single document metadata with OCR text & hash
documentsRouter.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const health = getDbHealth();

  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM land_documents WHERE id = $1', [id]);
        if (result.rows.length > 0) {
          const row = result.rows[0];
          return res.json({
            success: true,
            data: {
              document: {
                id: row.id,
                parcelId: row.parcel_id,
                documentCode: row.document_code,
                fileName: row.file_name,
                recordType: row.record_type,
                ocrLanguage: row.ocr_language,
                rawOcrText: row.raw_ocr_text,
                district: row.district,
                tehsil: row.tehsil,
                village: row.village,
                patwarCircle: row.patwar_circle,
                status: row.status,
                priority: row.priority,
                imageUri: row.image_uri,
                qualityMetrics: row.quality_metrics,
                extractedData: row.extracted_data,
                data: row.extracted_data,
                documentHash: row.document_hash,
                ocrConfidence: Number(row.ocr_confidence || 0),
                uploadedBy: row.uploaded_by,
                uploadedAt: row.uploaded_at,
              },
            },
            storageMode: health.storageMode,
          });
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[DOCUMENTS] PostgreSQL get single document error:', err.message);
    }
  }

  const doc = memoryStore.documents.get(id);

  if (!doc) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${id} not found in repository.`,
      },
    });
  }

  return res.json({
    success: true,
    data: { document: doc },
    storageMode: getDbHealth().storageMode,
  });
});

// POST /api/documents - Register document metadata, OCR text, and cryptographic hash
documentsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const body = req.body;
  const id = body.id || `DOC-RAJ-${Date.now()}`;
  const performer = req.user?.displayName || body.uploadedBy || 'Verification Operator';
  const badge = req.user?.badgeNumber || 'OPERATOR-DEMO';

  const rawOcrText = body.rawOcrText || body.ocrText || '';
  const documentHash = body.documentHash || sha256(rawOcrText || body.fileName || id);

  const newDoc = {
    id,
    parcelId: body.parcelId,
    documentCode: body.documentCode || `DOC-${Date.now().toString().slice(-6)}`,
    fileName: body.fileName || 'Scanned_Record.pdf',
    recordType: body.recordType || 'Jamabandi (RoR - Record of Rights)',
    ocrLanguage: body.ocrLanguage || 'hin+eng',
    rawOcrText,
    district: body.district || 'Jaipur',
    tehsil: body.tehsil || 'Sanganer',
    village: body.village || 'Rampur',
    patwarCircle: body.patwarCircle || 'Rampur Circle',
    status: body.status || 'Uploaded',
    priority: body.priority || 'Medium',
    imageUri: body.imageUri || '',
    qualityMetrics: body.qualityMetrics || {},
    qualityEnhancements: body.qualityEnhancements || {},
    extractedData: body.extractedData || body.data || {},
    data: body.data || body.extractedData || {},
    documentHash,
    ocrConfidence: body.ocrConfidence || (body.ocrEngines?.ensembleConfidence ?? 0),
    ocrEngines: body.ocrEngines,
    validationErrors: body.validationErrors || [],
    uploadedBy: performer,
    uploadedAt: new Date().toISOString(),
  };

  const health = getDbHealth();
  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO land_documents (
            id, parcel_id, document_code, file_name, record_type, ocr_language,
            raw_ocr_text, district, tehsil, village, patwar_circle, status, priority,
            image_uri, quality_metrics, extracted_data, document_hash, ocr_confidence,
            uploaded_by, uploaded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            raw_ocr_text = EXCLUDED.raw_ocr_text,
            extracted_data = EXCLUDED.extracted_data,
            ocr_confidence = EXCLUDED.ocr_confidence,
            document_hash = EXCLUDED.document_hash`,
          [
            newDoc.id,
            newDoc.parcelId || null,
            newDoc.documentCode,
            newDoc.fileName,
            newDoc.recordType,
            newDoc.ocrLanguage,
            newDoc.rawOcrText,
            newDoc.district,
            newDoc.tehsil,
            newDoc.village,
            newDoc.patwarCircle,
            newDoc.status,
            newDoc.priority,
            newDoc.imageUri,
            JSON.stringify(newDoc.qualityMetrics),
            JSON.stringify(newDoc.extractedData),
            newDoc.documentHash,
            newDoc.ocrConfidence,
            newDoc.uploadedBy,
            newDoc.uploadedAt,
          ]
        );
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[DOCUMENTS] PostgreSQL insert document error:', err.message);
    }
  }

  memoryStore.documents.set(id, newDoc);

  // If linked to parcel, update parcel metadata
  if (newDoc.parcelId) {
    const parcel = memoryStore.parcels.get(newDoc.parcelId);
    if (parcel) {
      parcel.documentId = id;
      parcel.documentName = newDoc.fileName;
      parcel.documentType = newDoc.recordType;
      memoryStore.parcels.set(newDoc.parcelId, parcel);
    }
  }

  await recordAuditLog({
    parcelId: newDoc.parcelId,
    documentId: id,
    entityType: 'DOCUMENT',
    entityId: id,
    actionType: 'DOCUMENT_REGISTERED',
    performedBy: performer,
    officerBadge: badge,
    details: {
      fileName: newDoc.fileName,
      recordType: newDoc.recordType,
      documentHash,
      ocrConfidence: newDoc.ocrConfidence,
    },
  });

  return res.status(201).json({
    success: true,
    data: { document: newDoc },
    message: `Document ${id} registered and hashed in controlled storage.`,
  });
});

// PATCH /api/documents/:id - Update document extraction, OCR text, or verification state
documentsRouter.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const patch = req.body;
  const performer = req.user?.displayName || patch.performedBy || 'Verification Officer';
  const badge = req.user?.badgeNumber || 'OFFICER-DEMO';

  const existingDoc = memoryStore.documents.get(id);

  const updatedDoc = {
    ...(existingDoc || {}),
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };

  if (patch.data && !patch.extractedData) {
    updatedDoc.extractedData = patch.data;
  }

  const rawText = patch.rawOcrText || updatedDoc.rawOcrText || '';
  if (rawText && !patch.documentHash) {
    updatedDoc.documentHash = sha256(rawText);
  }

  const health = getDbHealth();
  if (health.storageMode === 'postgres-postgis') {
    try {
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE land_documents SET
            status = COALESCE($1, status),
            raw_ocr_text = COALESCE($2, raw_ocr_text),
            extracted_data = COALESCE($3, extracted_data),
            ocr_confidence = COALESCE($4, ocr_confidence),
            document_hash = COALESCE($5, document_hash),
            parcel_id = COALESCE($6, parcel_id)
          WHERE id = $7`,
          [
            patch.status || null,
            patch.rawOcrText || null,
            patch.extractedData || patch.data ? JSON.stringify(patch.extractedData || patch.data) : null,
            patch.ocrConfidence ?? (patch.ocrEngines?.ensembleConfidence ?? null),
            updatedDoc.documentHash || null,
            patch.parcelId || null,
            id,
          ]
        );
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[DOCUMENTS] PostgreSQL update document error:', err.message);
    }
  }

  memoryStore.documents.set(id, updatedDoc);

  await recordAuditLog({
    parcelId: updatedDoc.parcelId,
    documentId: id,
    entityType: 'DOCUMENT',
    entityId: id,
    actionType: 'DOCUMENT_UPDATED',
    performedBy: performer,
    officerBadge: badge,
    details: {
      status: updatedDoc.status,
      fieldsUpdated: Object.keys(patch),
      documentHash: updatedDoc.documentHash,
    },
  });

  return res.json({
    success: true,
    data: { document: updatedDoc },
    message: `Document ${id} updated successfully.`,
    storageMode: health.storageMode,
  });
});

// DELETE /api/documents/:id - Archive document record
documentsRouter.delete('/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const performer = req.user?.displayName || req.body.performedBy || 'Officer';

  const doc = memoryStore.documents.get(id);
  if (doc) {
    doc.status = 'Archived';
    memoryStore.documents.set(id, doc);
  }

  await recordAuditLog({
    documentId: id,
    entityType: 'DOCUMENT',
    entityId: id,
    actionType: 'DOCUMENT_ARCHIVED',
    performedBy: performer,
    details: { reason: req.body.reason || 'Archived via administrative request.' },
  });

  return res.json({
    success: true,
    message: `Document ${id} archived.`,
  });
});
