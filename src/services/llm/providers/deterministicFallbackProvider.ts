/**
 * DHAROHAR - Deterministic Fallback Extraction Provider
 * 
 * Provides rule-based heuristic extraction based on the proven Indic OCR parser.
 * Always available offline with 0 cloud dependencies.
 */

import { LLMProvider } from './baseProvider';
import { LandRecordStructuredExtraction, ExtractedCoSharer } from '../types';
import { parseRevenueRecord } from '../../ocr/revenueRecordParser';

export class DeterministicFallbackProvider implements LLMProvider {
  name = 'Deterministic Fallback Parser';
  type = 'deterministic-fallback' as const;
  description = 'Rule-based Indic cadastral regex extraction engine (100% offline & reproducible).';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async extractStructuredLandRecord(
    ocrText: string,
    metadata?: any
  ): Promise<LandRecordStructuredExtraction> {
    const parsed = parseRevenueRecord(ocrText);
    const d = parsed.data;

    const coSharers: ExtractedCoSharer[] = (d.owners || []).map((o) => ({
      name: o.name,
      hindiName: o.hindiName,
      relationType: o.relationType,
      relativeName: o.relativeName,
      relativeHindiName: o.relativeHindiName,
      shareFraction: o.shareFraction,
      sharePercentage: o.sharePercentage,
    }));

    const primaryOwnerName = coSharers[0]?.name || null;

    const hasAreaMention = /रकबा|क्षेत्रफल|hectare|बीघा|biswa|bigha|\bha\b/i.test(ocrText);
    const validKhasra = d.khasraNo?.value && d.khasraNo.value !== '—' ? d.khasraNo.value : null;

    return {
      khasraNo: {
        value: validKhasra,
        hindiValue: validKhasra ? d.khasraNo?.hindiValue || null : null,
        evidence: validKhasra && d.khasraNo?.originalOcr ? `खसरा: ${d.khasraNo.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: validKhasra ? 'HIGH' : 'NEEDS_REVIEW',
      },
      khatauniNo: {
        value: d.khatauniNo?.value && d.khatauniNo.value !== '—' ? d.khatauniNo.value : null,
        hindiValue: d.khatauniNo?.hindiValue || null,
        evidence: d.khatauniNo?.originalOcr ? `खाता: ${d.khatauniNo.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.khatauniNo?.value ? 'HIGH' : 'NEEDS_REVIEW',
      },
      khewatNo: {
        value: d.khewatNo?.value && d.khewatNo.value !== '—' ? d.khewatNo.value : null,
        hindiValue: d.khewatNo?.hindiValue || null,
        evidence: d.khewatNo?.originalOcr ? `खेवट: ${d.khewatNo.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.khewatNo?.value ? 'MEDIUM' : 'LOW',
      },
      mauza: {
        value: d.villageMauza?.value && d.villageMauza.value !== '—' ? d.villageMauza.value : null,
        hindiValue: d.villageMauza?.hindiValue || null,
        evidence: d.villageMauza?.originalOcr ? `मौजा: ${d.villageMauza.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.villageMauza?.value ? 'HIGH' : 'NEEDS_REVIEW',
      },
      patwarCircle: {
        value: d.patwarCircle?.value && d.patwarCircle.value !== '—' ? d.patwarCircle.value : null,
        hindiValue: d.patwarCircle?.hindiValue || null,
        evidence: d.patwarCircle?.originalOcr ? `पटवार वृत्त: ${d.patwarCircle.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.patwarCircle?.value ? 'HIGH' : 'LOW',
      },
      tehsil: {
        value: d.tehsil?.value && d.tehsil.value !== '—' ? d.tehsil.value : null,
        hindiValue: d.tehsil?.hindiValue || null,
        evidence: d.tehsil?.originalOcr ? `तहसील: ${d.tehsil.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.tehsil?.value ? 'HIGH' : 'NEEDS_REVIEW',
      },
      district: {
        value: d.district?.value && d.district.value !== '—' ? d.district.value : null,
        hindiValue: d.district?.hindiValue || null,
        evidence: d.district?.originalOcr ? `ज़िला: ${d.district.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.district?.value ? 'HIGH' : 'NEEDS_REVIEW',
      },
      settlementYear: {
        value: d.settlementYear?.value && d.settlementYear.value !== '—' ? d.settlementYear.value : null,
        hindiValue: d.settlementYear?.hindiValue || null,
        evidence: d.settlementYear?.originalOcr ? `संवत: ${d.settlementYear.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.settlementYear?.value ? 'MEDIUM' : 'LOW',
      },
      landClassification: {
        value: d.landClassification?.value || null,
        hindiValue: d.landClassification?.hindiValue || null,
        evidence: d.landClassification?.originalOcr ? `वर्गीकरण: ${d.landClassification.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.landClassification?.value ? 'HIGH' : 'LOW',
      },
      rakba: {
        value: hasAreaMention && d.rakbaArea?.totalHectares !== undefined ? Number(d.rakbaArea.totalHectares) : null,
        evidence: hasAreaMention && d.rakbaArea ? `रकबा: ${d.rakbaArea.bigha} बीघा ${d.rakbaArea.biswa} बिस्वा (${d.rakbaArea.totalHectares} Ha)` : null,
        source: 'deterministic',
        confidenceCategory: hasAreaMention && d.rakbaArea?.totalHectares ? 'HIGH' : 'NEEDS_REVIEW',
      },
      rakbaUnit: {
        value: 'Hectare',
        evidence: 'हेक्टेयर / Hectare standard',
        source: 'deterministic',
        confidenceCategory: 'HIGH',
      },
      rakbaBighaBiswa: {
        value: d.rakbaArea ? `${d.rakbaArea.bigha} Bigha ${d.rakbaArea.biswa} Biswa` : null,
        evidence: d.rakbaArea ? `${d.rakbaArea.bigha} बीघा ${d.rakbaArea.biswa} बिस्वा` : null,
        source: 'deterministic',
        confidenceCategory: d.rakbaArea ? 'HIGH' : 'LOW',
      },
      ownerName: {
        value: primaryOwnerName,
        hindiValue: coSharers[0]?.hindiName || null,
        evidence: primaryOwnerName ? `खातेदार: ${primaryOwnerName}` : null,
        source: 'deterministic',
        confidenceCategory: primaryOwnerName ? 'HIGH' : 'NEEDS_REVIEW',
      },
      coSharers: {
        value: coSharers,
        evidence: coSharers.map((c) => `${c.name} (${c.sharePercentage}%)`).join(', ') || null,
        source: 'deterministic',
        confidenceCategory: coSharers.length > 0 ? 'HIGH' : 'LOW',
      },
      ownershipShares: {
        value: coSharers.length > 0 ? `${coSharers.length} Co-sharer(s)` : null,
        evidence: coSharers.map((c) => `${c.shareFraction || ''} (${c.sharePercentage || 0}%)`).join(', ') || null,
        source: 'deterministic',
        confidenceCategory: coSharers.length > 0 ? 'HIGH' : 'LOW',
      },
      lagaan: {
        value: d.annualLagaanRevenue?.value !== undefined ? String(d.annualLagaanRevenue.value) : null,
        evidence: d.annualLagaanRevenue?.originalOcr ? `लगान: ${d.annualLagaanRevenue.originalOcr}` : null,
        source: 'deterministic',
        confidenceCategory: d.annualLagaanRevenue?.value ? 'MEDIUM' : 'LOW',
      },
      encumbrance: {
        value: d.encumbrance?.isMortgaged ? 'Mortgaged' : 'None',
        evidence: d.encumbrance?.remarks || null,
        source: 'deterministic',
        confidenceCategory: 'MEDIUM',
      },
      mutationReference: {
        value: d.mutationDetails?.lastMutationNo || null,
        evidence: d.mutationDetails?.lastMutationNo ? `नामांतरण: ${d.mutationDetails.lastMutationNo}` : null,
        source: 'deterministic',
        confidenceCategory: d.mutationDetails?.lastMutationNo ? 'HIGH' : 'LOW',
      },
      inheritanceReference: {
        value: null,
        evidence: null,
        source: 'deterministic',
        confidenceCategory: 'LOW',
      },
      documentType: {
        value: parsed.detectedRecordType || metadata?.recordType || 'Jamabandi (RoR - Record of Rights)',
        evidence: parsed.detectedRecordType || null,
        source: 'deterministic',
        confidenceCategory: 'HIGH',
      },
      documentDate: {
        value: d.settlementYear?.value || null,
        evidence: null,
        source: 'deterministic',
        confidenceCategory: 'LOW',
      },
      evidenceText: ocrText.slice(0, 300),
    };
  }
}
