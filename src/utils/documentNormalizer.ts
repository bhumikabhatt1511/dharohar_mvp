/**
 * DHAROHAR Document Normalizer & State Recovery Engine
 * 
 * Ensures all DocumentRecord objects in state, local storage, or backend responses
 * strictly conform to the expected UI schema with zero undefined or null sub-properties.
 * Prevents runtime TypeErrors across all views and enables safe recovery of corrupted states.
 */

import {
  DocumentRecord,
  LandRecordData,
  QualityMetrics,
  QualityEnhancements,
  OcrEngineMetrics,
  DocumentStatus,
  LandClassificationType,
  ExtractedField,
} from '../types';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';

export const createDefaultLandRecordData = (village = '', district = '', tehsil = ''): LandRecordData => ({
  khasraNo: {
    value: '—',
    hindiValue: '',
    originalOcr: '',
    confidence: 0,
  },
  khatauniNo: {
    value: '—',
    hindiValue: '',
    originalOcr: '',
    confidence: 0,
  },
  khewatNo: {
    value: '—',
    hindiValue: '',
    originalOcr: '',
    confidence: 0,
  },
  villageMauza: {
    value: village,
    hindiValue: '',
    originalOcr: village,
    confidence: village ? 100 : 0,
  },
  patwarCircle: {
    value: '',
    hindiValue: '',
    originalOcr: '',
    confidence: 0,
  },
  tehsil: {
    value: tehsil,
    hindiValue: '',
    originalOcr: tehsil,
    confidence: tehsil ? 100 : 0,
  },
  district: {
    value: district || 'Jaipur',
    hindiValue: '',
    originalOcr: district || 'Jaipur',
    confidence: 100,
  },
  state: {
    value: 'Rajasthan',
    hindiValue: 'राजस्थान',
    originalOcr: 'Rajasthan',
    confidence: 100,
  },
  settlementYear: {
    value: '2024-2025',
    hindiValue: '२०२४-२५',
    originalOcr: '2024-2025',
    confidence: 100,
  },
  owners: [],
  rakbaArea: {
    bigha: 0,
    biswa: 0,
    biswansi: 0,
    totalHectares: 0,
    standardAcre: 0,
    confidence: 0,
  },
  landClassification: {
    value: 'Barani (Rainfed)',
    hindiValue: 'बारानी',
    originalOcr: '',
    confidence: 0,
  },
  soilClass: {
    value: '—',
    originalOcr: '',
    confidence: 0,
  },
  annualLagaanRevenue: {
    value: 0,
    originalOcr: '',
    confidence: 0,
  },
  encumbrance: {
    isMortgaged: false,
    courtInjunctionActive: false,
    remarks: 'No active lien or encumbrance recorded.',
  },
  mutationDetails: {
    lastMutationNo: '—',
    mutationDate: '—',
    mutationType: 'None',
    approvingAuthority: '—',
  },
});

export const createDefaultQualityMetrics = (): QualityMetrics => ({
  dpi: 300,
  skewAngle: 0,
  blurScore: 88,
  lighting: 'Uniform',
  stainsAndFolds: 'Clean',
  contrastRatio: 16.0,
  overallScore: 90,
  passed: true,
});

export const createDefaultQualityEnhancements = (): QualityEnhancements => ({
  deskew: true,
  deskewAngle: 0,
  binarize: false,
  denoise: true,
  contrastBoost: true,
  sharpen: true,
  invertColors: false,
  brightness: 0,
  contrast: 100,
  zoom: 100,
});

export const createDefaultOcrEngines = (): OcrEngineMetrics => ({
  tesseractConfidence: 0,
  trocrConfidence: 0,
  indicOcrConfidence: 0,
  ensembleConfidence: 0,
  characterErrorRate: 0,
  processingTimeMs: 0,
});

const VALID_STATUSES: Set<DocumentStatus> = new Set([
  'Uploaded',
  'Processing',
  'Extraction Ready',
  'Validation Review',
  'Pending Verification',
  'Under Review',
  'Flagged for Patwari',
  'Verified',
  'Rejected',
  'Quality Checked',
]);

/**
 * Normalizes any document object into a strictly valid DocumentRecord.
 */
export function normalizeDocumentRecord(rawDoc: any, fallback?: DocumentRecord): DocumentRecord {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return fallback || SAMPLE_DOCUMENTS[0];
  }

  const sampleMatch = SAMPLE_DOCUMENTS.find((s) => s.id === rawDoc.id) || fallback;

  const id = typeof rawDoc.id === 'string' && rawDoc.id.trim() ? rawDoc.id : (sampleMatch?.id || `DOC-RAJ-2025-${Math.floor(10000 + Math.random() * 90000)}`);
  const documentCode = typeof rawDoc.documentCode === 'string' && rawDoc.documentCode.trim() ? rawDoc.documentCode : (sampleMatch?.documentCode || `RJ-REV-${id.slice(-5)}`);
  const fileName = typeof rawDoc.fileName === 'string' && rawDoc.fileName.trim() ? rawDoc.fileName : (sampleMatch?.fileName || 'Land_Record_Document.pdf');
  const recordType = typeof rawDoc.recordType === 'string' && rawDoc.recordType.trim() ? rawDoc.recordType : (sampleMatch?.recordType || 'Jamabandi (RoR - Record of Rights)');
  const district = typeof rawDoc.district === 'string' ? rawDoc.district : (sampleMatch?.district || 'Jaipur');
  const tehsil = typeof rawDoc.tehsil === 'string' ? rawDoc.tehsil : (sampleMatch?.tehsil || 'Sanganer');
  const village = typeof rawDoc.village === 'string' ? rawDoc.village : (sampleMatch?.village || 'Rampur');
  const patwarCircle = typeof rawDoc.patwarCircle === 'string' ? rawDoc.patwarCircle : (sampleMatch?.patwarCircle || '');
  const status: DocumentStatus = VALID_STATUSES.has(rawDoc.status) ? rawDoc.status : (sampleMatch?.status || 'Uploaded');
  const priority = rawDoc.priority === 'High' || rawDoc.priority === 'Medium' || rawDoc.priority === 'Low' ? rawDoc.priority : (sampleMatch?.priority || 'Medium');
  const uploadedAt = typeof rawDoc.uploadedAt === 'string' ? rawDoc.uploadedAt : (sampleMatch?.uploadedAt || new Date().toLocaleString());
  const imageUri = typeof rawDoc.imageUri === 'string' ? rawDoc.imageUri : (sampleMatch?.imageUri || '');
  const isSampleDocument = Boolean(rawDoc.isSampleDocument ?? sampleMatch?.isSampleDocument ?? false);
  const rawOcrText = typeof rawDoc.rawOcrText === 'string' ? rawDoc.rawOcrText : (sampleMatch?.rawOcrText || '');
  const ocrLanguage = typeof rawDoc.ocrLanguage === 'string' ? rawDoc.ocrLanguage : (sampleMatch?.ocrLanguage || 'hin+eng');
  const parcelId = typeof rawDoc.parcelId === 'string' ? rawDoc.parcelId : sampleMatch?.parcelId;

  // Safe Quality Metrics
  const qmRaw = rawDoc.qualityMetrics || sampleMatch?.qualityMetrics;
  const qualityMetrics: QualityMetrics = {
    dpi: typeof qmRaw?.dpi === 'number' ? qmRaw.dpi : 300,
    skewAngle: typeof qmRaw?.skewAngle === 'number' ? qmRaw.skewAngle : 0,
    blurScore: typeof qmRaw?.blurScore === 'number' ? qmRaw.blurScore : 88,
    lighting: qmRaw?.lighting || 'Uniform',
    stainsAndFolds: qmRaw?.stainsAndFolds || 'Clean',
    contrastRatio: typeof qmRaw?.contrastRatio === 'number' ? qmRaw.contrastRatio : 16.0,
    overallScore: typeof qmRaw?.overallScore === 'number' ? qmRaw.overallScore : 90,
    passed: qmRaw?.passed !== undefined ? Boolean(qmRaw.passed) : true,
  };

  // Safe Quality Enhancements
  const qeRaw = rawDoc.qualityEnhancements || sampleMatch?.qualityEnhancements;
  const qualityEnhancements: QualityEnhancements = {
    deskew: Boolean(qeRaw?.deskew ?? true),
    deskewAngle: typeof qeRaw?.deskewAngle === 'number' ? qeRaw.deskewAngle : 0,
    binarize: Boolean(qeRaw?.binarize ?? false),
    denoise: Boolean(qeRaw?.denoise ?? true),
    contrastBoost: Boolean(qeRaw?.contrastBoost ?? true),
    sharpen: Boolean(qeRaw?.sharpen ?? true),
    invertColors: Boolean(qeRaw?.invertColors ?? false),
    brightness: typeof qeRaw?.brightness === 'number' ? qeRaw.brightness : 0,
    contrast: typeof qeRaw?.contrast === 'number' ? qeRaw.contrast : 100,
    zoom: typeof qeRaw?.zoom === 'number' ? qeRaw.zoom : 100,
  };

  // Safe OCR Engines
  const ocrRaw = rawDoc.ocrEngines || sampleMatch?.ocrEngines;
  const rawConfidence = typeof rawDoc.ocrConfidence === 'number' ? rawDoc.ocrConfidence : (ocrRaw?.ensembleConfidence ?? 0);
  const ocrEngines: OcrEngineMetrics = {
    tesseractConfidence: typeof ocrRaw?.tesseractConfidence === 'number' ? ocrRaw.tesseractConfidence : rawConfidence,
    trocrConfidence: typeof ocrRaw?.trocrConfidence === 'number' ? ocrRaw.trocrConfidence : rawConfidence,
    indicOcrConfidence: typeof ocrRaw?.indicOcrConfidence === 'number' ? ocrRaw.indicOcrConfidence : rawConfidence,
    ensembleConfidence: typeof ocrRaw?.ensembleConfidence === 'number' ? ocrRaw.ensembleConfidence : rawConfidence,
    characterErrorRate: typeof ocrRaw?.characterErrorRate === 'number' ? ocrRaw.characterErrorRate : 0,
    processingTimeMs: typeof ocrRaw?.processingTimeMs === 'number' ? ocrRaw.processingTimeMs : 0,
  };

  // Safe Validation Errors
  const validationErrors = Array.isArray(rawDoc.validationErrors)
    ? rawDoc.validationErrors
    : (Array.isArray(sampleMatch?.validationErrors) ? sampleMatch.validationErrors : []);

  // Safe Processing Logs
  const processingLogs = Array.isArray(rawDoc.processingLogs)
    ? rawDoc.processingLogs
    : (Array.isArray(sampleMatch?.processingLogs) ? sampleMatch.processingLogs : []);

  // Safe Audit Trail
  const auditRaw = rawDoc.auditTrail || sampleMatch?.auditTrail || {};
  const auditTrail = {
    uploadedBy: auditRaw.uploadedBy || rawDoc.uploadedBy || 'Verification Operator',
    processedAt: auditRaw.processedAt,
    verifiedBy: auditRaw.verifiedBy,
    verifiedAt: auditRaw.verifiedAt,
    verifierBadge: auditRaw.verifierBadge,
    digitalSignatureHash: auditRaw.digitalSignatureHash,
    certificateNumber: auditRaw.certificateNumber,
    qrPayload: auditRaw.qrPayload,
    verificationNotes: auditRaw.verificationNotes,
    patwariRemarks: auditRaw.patwariRemarks,
  };

  // Safe Land Record Data
  const sourceData = (rawDoc.data && typeof rawDoc.data === 'object' && !Array.isArray(rawDoc.data))
    ? rawDoc.data
    : (rawDoc.extractedData && typeof rawDoc.extractedData === 'object' && !Array.isArray(rawDoc.extractedData))
    ? rawDoc.extractedData
    : (sampleMatch?.data || createDefaultLandRecordData(village, district, tehsil));

  const safeField = (f: any, fallbackVal = '—', fallbackConfidence = 0) => {
    if (f && typeof f === 'object' && !Array.isArray(f)) {
      return {
        value: typeof f.value === 'string' || typeof f.value === 'number' ? String(f.value) : fallbackVal,
        hindiValue: typeof f.hindiValue === 'string' ? f.hindiValue : undefined,
        originalOcr: typeof f.originalOcr === 'string' ? f.originalOcr : String(f.value || ''),
        confidence: typeof f.confidence === 'number' ? f.confidence : fallbackConfidence,
        bbox: f.bbox,
        manualOverride: Boolean(f.manualOverride),
        isFlagged: Boolean(f.isFlagged),
      };
    }
    if (typeof f === 'string' || typeof f === 'number') {
      return {
        value: String(f),
        hindiValue: undefined,
        originalOcr: String(f),
        confidence: fallbackConfidence,
      };
    }
    return {
      value: fallbackVal,
      hindiValue: undefined,
      originalOcr: '',
      confidence: fallbackConfidence,
    };
  };

  const safeOwners = Array.isArray(sourceData.owners) ? sourceData.owners.map((o: any, idx: number) => ({
    id: o?.id || `own-${id}-${idx}`,
    name: o?.name || (o?.hindiName ? o.hindiName : 'Unassigned Co-sharer'),
    hindiName: o?.hindiName || o?.name,
    relationType: o?.relationType || 's/o',
    relativeName: o?.relativeName || '—',
    relativeHindiName: o?.relativeHindiName,
    shareFraction: o?.shareFraction || '1/1',
    sharePercentage: typeof o?.sharePercentage === 'number' ? o.sharePercentage : 100,
    casteOrCategory: o?.casteOrCategory,
    aadhaarRef: o?.aadhaarRef,
    status: o?.status || 'Active Co-sharer',
  })) : (sampleMatch?.data?.owners || []);

  const rakbaRaw = sourceData.rakbaArea;
  const rakbaArea = {
    bigha: typeof rakbaRaw?.bigha === 'number' ? rakbaRaw.bigha : (sampleMatch?.data?.rakbaArea?.bigha ?? 0),
    biswa: typeof rakbaRaw?.biswa === 'number' ? rakbaRaw.biswa : (sampleMatch?.data?.rakbaArea?.biswa ?? 0),
    biswansi: typeof rakbaRaw?.biswansi === 'number' ? rakbaRaw.biswansi : (sampleMatch?.data?.rakbaArea?.biswansi ?? 0),
    totalHectares: typeof rakbaRaw?.totalHectares === 'number' ? rakbaRaw.totalHectares : (sampleMatch?.data?.rakbaArea?.totalHectares ?? 0),
    standardAcre: typeof rakbaRaw?.standardAcre === 'number' ? rakbaRaw.standardAcre : (sampleMatch?.data?.rakbaArea?.standardAcre ?? 0),
    confidence: typeof rakbaRaw?.confidence === 'number' ? rakbaRaw.confidence : (sampleMatch?.data?.rakbaArea?.confidence ?? 0),
    bbox: rakbaRaw?.bbox,
    manualOverride: Boolean(rakbaRaw?.manualOverride),
  };

  const encRaw = sourceData.encumbrance;
  const encumbrance = {
    isMortgaged: Boolean(encRaw?.isMortgaged),
    courtInjunctionActive: Boolean(encRaw?.courtInjunctionActive),
    remarks: typeof encRaw?.remarks === 'string' ? encRaw.remarks : 'No active lien recorded.',
  };

  const mutRaw = sourceData.mutationDetails;
  const mutationDetails = {
    lastMutationNo: mutRaw?.lastMutationNo || '—',
    mutationDate: mutRaw?.mutationDate || '—',
    mutationType: mutRaw?.mutationType || 'None',
    approvingAuthority: mutRaw?.approvingAuthority || '—',
  };

  const validLandClasses: LandClassificationType[] = [
    'Chahi (Well Irrigated)',
    'Nahri (Canal Irrigated)',
    'Barani (Rainfed)',
    'Gair Mumkin (Non-arable / Built-up)',
    'Banjar Jadid / Qadeem (Fallow)',
  ];

  const rawLandClassVal = (sourceData.landClassification && typeof sourceData.landClassification === 'object'
    ? sourceData.landClassification.value
    : sourceData.landClassification) || 'Chahi (Well Irrigated)';

  const normalizedLandClass: LandClassificationType = validLandClasses.includes(rawLandClassVal)
    ? rawLandClassVal
    : (sampleMatch?.data?.landClassification?.value || 'Chahi (Well Irrigated)');

  const landClassification: ExtractedField<LandClassificationType> = {
    value: normalizedLandClass,
    hindiValue: sourceData.landClassification?.hindiValue,
    originalOcr: sourceData.landClassification?.originalOcr || String(normalizedLandClass),
    confidence: typeof sourceData.landClassification?.confidence === 'number' ? sourceData.landClassification.confidence : 90,
    bbox: sourceData.landClassification?.bbox,
    manualOverride: Boolean(sourceData.landClassification?.manualOverride),
    isFlagged: Boolean(sourceData.landClassification?.isFlagged),
  };

  const data: LandRecordData = {
    khasraNo: safeField(sourceData.khasraNo, sampleMatch?.data?.khasraNo?.value || '—', 90),
    khatauniNo: safeField(sourceData.khatauniNo, sampleMatch?.data?.khatauniNo?.value || '—', 90),
    khewatNo: safeField(sourceData.khewatNo, sampleMatch?.data?.khewatNo?.value || '—', 90),
    villageMauza: safeField(sourceData.villageMauza, village || 'Rampur', 100),
    patwarCircle: safeField(sourceData.patwarCircle, patwarCircle || 'Circle 1', 95),
    tehsil: safeField(sourceData.tehsil, tehsil || 'Sanganer', 100),
    district: safeField(sourceData.district, district || 'Jaipur', 100),
    state: safeField(sourceData.state, 'Rajasthan', 100),
    settlementYear: safeField(sourceData.settlementYear, '2024-2025', 95),
    owners: safeOwners,
    rakbaArea,
    landClassification,
    soilClass: safeField(sourceData.soilClass, 'Domat II', 85),
    annualLagaanRevenue: {
      value: typeof sourceData.annualLagaanRevenue?.value === 'number' ? sourceData.annualLagaanRevenue.value : (sampleMatch?.data?.annualLagaanRevenue?.value ?? 0),
      originalOcr: sourceData.annualLagaanRevenue?.originalOcr || '',
      confidence: typeof sourceData.annualLagaanRevenue?.confidence === 'number' ? sourceData.annualLagaanRevenue.confidence : 90,
    },
    encumbrance,
    mutationDetails,
  };

  return {
    id,
    parcelId,
    documentCode,
    fileName,
    uploadedAt,
    recordType,
    district,
    tehsil,
    village,
    patwarCircle,
    status,
    priority,
    imageUri,
    isSampleDocument,
    rawOcrText,
    ocrLanguage,
    qualityMetrics,
    qualityEnhancements,
    data,
    ocrEngines,
    validationErrors,
    auditTrail,
    processingLogs,
    isAccepted: Boolean(rawDoc.isAccepted),
  };
}

/**
 * Normalizes an array of documents, removing any invalid non-object items.
 */
export function normalizeDocumentList(list: any[]): DocumentRecord[] {
  if (!Array.isArray(list) || list.length === 0) {
    return SAMPLE_DOCUMENTS;
  }
  const result: DocumentRecord[] = [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      result.push(normalizeDocumentRecord(item));
    }
  }
  return result.length > 0 ? result : SAMPLE_DOCUMENTS;
}
