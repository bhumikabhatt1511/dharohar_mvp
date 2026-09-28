/**
 * DHAROHAR - LLM-Assisted Indic Land Record Intelligence Types
 * Phase 6: OCR -> LLM Extraction -> Validation -> Human Verification
 */

export type ProviderType = 'deterministic-fallback' | 'local-dev' | 'api-connected';

export type ConfidenceCategory = 'HIGH' | 'MEDIUM' | 'LOW' | 'NEEDS_REVIEW';

export type FieldSource = 'ocr' | 'llm' | 'deterministic' | 'human';

export interface ExtractedFieldValue<T = string> {
  value: T | null;
  hindiValue?: string | null;
  evidence?: string | null;
  source: FieldSource;
  confidenceCategory?: ConfidenceCategory;
  isAmbiguous?: boolean;
}

export interface ExtractedCoSharer {
  name: string;
  hindiName?: string;
  relationType?: string;
  relativeName?: string;
  relativeHindiName?: string;
  shareFraction?: string;
  sharePercentage?: number;
}

export interface LandRecordStructuredExtraction {
  khasraNo: ExtractedFieldValue<string>;
  khatauniNo: ExtractedFieldValue<string>;
  khewatNo: ExtractedFieldValue<string>;
  mauza: ExtractedFieldValue<string>;
  patwarCircle: ExtractedFieldValue<string>;
  tehsil: ExtractedFieldValue<string>;
  district: ExtractedFieldValue<string>;
  settlementYear: ExtractedFieldValue<string>;
  landClassification: ExtractedFieldValue<string>;
  rakba: ExtractedFieldValue<number>;
  rakbaUnit: ExtractedFieldValue<string>;
  rakbaBighaBiswa?: ExtractedFieldValue<string>;
  ownerName: ExtractedFieldValue<string>;
  coSharers: ExtractedFieldValue<ExtractedCoSharer[]>;
  ownershipShares: ExtractedFieldValue<string>;
  lagaan: ExtractedFieldValue<string>;
  encumbrance: ExtractedFieldValue<string>;
  mutationReference: ExtractedFieldValue<string>;
  inheritanceReference: ExtractedFieldValue<string>;
  documentType: ExtractedFieldValue<string>;
  documentDate: ExtractedFieldValue<string>;
  sourcePage?: number;
  evidenceText?: string;
}

export type FieldComparisonStatus = 'MATCH' | 'CONFLICT' | 'MISSING' | 'NEEDS_REVIEW';

export interface FieldComparisonItem {
  field: string;
  label: string;
  hindiLabel: string;
  deterministicValue: string | number | null;
  llmValue: string | number | null;
  evidence?: string | null;
  status: FieldComparisonStatus;
  acceptedValue?: string | number | null;
  acceptedSource?: 'deterministic' | 'llm' | 'manual';
  notes?: string;
}

export interface LLMExtractionResult {
  provider: string;
  providerType: ProviderType;
  rawResponse?: string;
  extraction: LandRecordStructuredExtraction;
  comparisons: FieldComparisonItem[];
  matchCount: number;
  conflictsCount: number;
  missingCount: number;
  needsReviewCount: number;
  requiresHumanReview: boolean;
  executionTimeMs: number;
  timestamp: string;
}

export interface CrossDocumentFieldComparison {
  field: string;
  label: string;
  valuesByDocument: Record<string, string | number | null>;
  isConsistent: boolean;
  status: 'CONSISTENT' | 'CONFLICT_DETECTED' | 'INSUFFICIENT_DATA';
  discrepancyNote?: string;
}

export interface CrossDocumentComparisonResult {
  parcelId: string;
  documentsCompared: Array<{
    id: string;
    documentCode: string;
    fileName: string;
    recordType: string;
  }>;
  fields: CrossDocumentFieldComparison[];
  overallStatus: 'CONSISTENT' | 'CONFLICT_DETECTED';
  conflictCount: number;
  summary: string;
}

export interface CadastralExtractionTrainingSample {
  sampleId: string;
  documentType: string;
  language: 'hi' | 'en' | 'hi+en';
  rawOcrText: string;
  groundTruthStructured: Partial<LandRecordStructuredExtraction>;
  humanVerifiedCorrections?: Record<string, any>;
  knownAmbiguities?: string[];
  notes?: string;
}
