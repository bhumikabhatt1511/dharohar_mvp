/**
 * DHAROHAR - Cross-Document Cadastral Intelligence Foundation
 * 
 * Compares structured extractions across multiple historical / transaction documents
 * linked to the same parcel (e.g. Jamabandi RoR vs Sale Deed vs Mutation Order vs Girdawari).
 * Detects cross-document consistency and area/owner discrepancies without making unilateral legal judgments.
 */

import {
  CrossDocumentComparisonResult,
  CrossDocumentFieldComparison,
  LandRecordStructuredExtraction,
} from './types';
import { normalizeCadastralValue } from './reconciliationEngine';

export interface DocumentRecordInput {
  id: string;
  documentCode: string;
  fileName: string;
  recordType: string;
  extraction: LandRecordStructuredExtraction;
}

const COMPARISON_KEYS: Array<{
  field: keyof LandRecordStructuredExtraction;
  label: string;
  isNumeric?: boolean;
}> = [
  { field: 'khasraNo', label: 'Khasra Number' },
  { field: 'khatauniNo', label: 'Khatauni Number' },
  { field: 'khewatNo', label: 'Khewat Number' },
  { field: 'mauza', label: 'Village / Mauza' },
  { field: 'rakba', label: 'Total Area (Rakba)', isNumeric: true },
  { field: 'ownerName', label: 'Primary Owner' },
  { field: 'mutationReference', label: 'Mutation Order' },
];

export class CrossDocumentCadastralAnalyzer {
  /**
   * Compares structured fields across 2 or more documents for a given parcel
   */
  static analyzeParcelDocuments(
    parcelId: string,
    documents: DocumentRecordInput[]
  ): CrossDocumentComparisonResult {
    if (!documents || documents.length < 2) {
      return {
        parcelId,
        documentsCompared: (documents || []).map((d) => ({
          id: d.id,
          documentCode: d.documentCode,
          fileName: d.fileName,
          recordType: d.recordType,
        })),
        fields: [],
        overallStatus: 'CONSISTENT',
        conflictCount: 0,
        summary: 'At least 2 documents are required for multi-document cross-verification.',
      };
    }

    const fieldsResult: CrossDocumentFieldComparison[] = [];
    let conflictCount = 0;

    for (const item of COMPARISON_KEYS) {
      const valuesByDoc: Record<string, string | number | null> = {};
      const distinctNonEmptyValues: Array<{ docLabel: string; raw: any; normalized: string }> = [];

      for (const doc of documents) {
        const docLabel = `${doc.recordType} (${doc.documentCode})`;
        const extractedField = doc.extraction[item.field] as any;
        const val = extractedField?.value ?? null;
        valuesByDoc[docLabel] = val;

        if (val !== null && val !== undefined && val !== '') {
          distinctNonEmptyValues.push({
            docLabel,
            raw: val,
            normalized: item.isNumeric
              ? typeof val === 'number'
                ? val.toFixed(4)
                : parseFloat(String(val)).toFixed(4)
              : normalizeCadastralValue(val),
          });
        }
      }

      if (distinctNonEmptyValues.length < 2) {
        fieldsResult.push({
          field: item.field,
          label: item.label,
          valuesByDocument: valuesByDoc,
          isConsistent: true,
          status: 'INSUFFICIENT_DATA',
          discrepancyNote: 'Fewer than 2 documents contain this field.',
        });
        continue;
      }

      // Check if all normalized values match
      const firstNormalized = distinctNonEmptyValues[0].normalized;
      const hasMismatch = distinctNonEmptyValues.some((v) => v.normalized !== firstNormalized);

      if (hasMismatch) {
        conflictCount++;
        const mismatchSummary = distinctNonEmptyValues
          .map((v) => `${v.docLabel}: "${v.raw}"`)
          .join(' vs ');

        fieldsResult.push({
          field: item.field,
          label: item.label,
          valuesByDocument: valuesByDoc,
          isConsistent: false,
          status: 'CONFLICT_DETECTED',
          discrepancyNote: `Discrepancy detected across documents [${mismatchSummary}]`,
        });
      } else {
        fieldsResult.push({
          field: item.field,
          label: item.label,
          valuesByDocument: valuesByDoc,
          isConsistent: true,
          status: 'CONSISTENT',
          discrepancyNote: 'Values are strictly consistent across all compared documents.',
        });
      }
    }

    const overallStatus = conflictCount > 0 ? 'CONFLICT_DETECTED' : 'CONSISTENT';
    const summary =
      conflictCount > 0
        ? `Identified ${conflictCount} cross-document cadastral discrepancy(ies) across ${documents.length} records. Human verification required before final digital certification.`
        : `All ${fieldsResult.filter((f) => f.status === 'CONSISTENT').length} verifiable fields match consistently across ${documents.length} documents.`;

    return {
      parcelId,
      documentsCompared: documents.map((d) => ({
        id: d.id,
        documentCode: d.documentCode,
        fileName: d.fileName,
        recordType: d.recordType,
      })),
      fields: fieldsResult,
      overallStatus,
      conflictCount,
      summary,
    };
  }
}
