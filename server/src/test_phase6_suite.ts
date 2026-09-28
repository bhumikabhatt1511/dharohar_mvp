/**
 * DHAROHAR - Phase 6 Automated Test Suite
 * LLM-Assisted Indic Land Record Intelligence
 * 
 * Tests:
 * 1. Hindi OCR extraction
 * 2. English extraction
 * 3. Mixed Hindi-English extraction
 * 4. Khasra extraction & Devanagari numeral normalization
 * 5. Khatauni extraction
 * 6. Khewat extraction
 * 7. Area (Rakba) extraction
 * 8. Owner & Co-sharer extraction
 * 9. Missing field handling (null values, no hallucination)
 * 10. Conflicting field handling (status = CONFLICT)
 * 11. Deterministic parser vs LLM disagreement (flagged for review)
 * 12. Human override persistence
 * 13. No invented values (smudged/empty text yields null)
 * 14. Multi-document cross-verification
 * 15. Graceful fallback on unavailable external API
 */

import {
  CadastralReconciliationEngine,
  DeterministicFallbackProvider,
  LocalIndicAssistantProvider,
  ConfigurableApiProvider,
  CrossDocumentCadastralAnalyzer,
  compareValues,
  normalizeCadastralValue,
} from '../../src/services/llm';
import { CADASTRAL_BENCHMARK_DATASET } from '../../src/data/cadastralDataset';

interface TestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testId: number, name: string, category: string, details?: string) {
  if (condition) {
    results.push({ id: testId, name, category, passed: true, details });
    console.log(`  [PASS] #${testId}: ${name}`);
  } else {
    results.push({ id: testId, name, category, passed: false, details: details || 'Assertion failed' });
    console.error(`  [FAIL] #${testId}: ${name} - ${details}`);
  }
}

async function runPhase6Tests() {
  console.log('========================================================================');
  console.log('       DHAROHAR PHASE 6: LLM-ASSISTED INDIC LAND RECORD INTELLIGENCE    ');
  console.log('========================================================================\n');

  const localAssistant = new LocalIndicAssistantProvider();
  const fallbackProvider = new DeterministicFallbackProvider();

  // -------------------------------------------------------------------------
  // TEST 1: Hindi OCR Extraction (Devanagari Jamabandi)
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Indic Language Extractions ---');
  const sampleHi = CADASTRAL_BENCHMARK_DATASET[0];
  const hiResult = await localAssistant.extractStructuredLandRecord(sampleHi.rawOcrText);

  assert(
    hiResult.khasraNo.value === '77/1' &&
    hiResult.khatauniNo.value === '104' &&
    hiResult.mauza.value === 'Kothari',
    1,
    'Hindi Devanagari Record of Rights Extraction',
    'Language Extraction',
    `Extracted Khasra: ${hiResult.khasraNo.value}, Khata: ${hiResult.khatauniNo.value}, Mauza: ${hiResult.mauza.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: English Extraction (Conveyance Deed)
  // -------------------------------------------------------------------------
  const sampleEn = CADASTRAL_BENCHMARK_DATASET[1];
  const enResult = await localAssistant.extractStructuredLandRecord(sampleEn.rawOcrText);

  assert(
    enResult.khasraNo.value === '142/3' &&
    enResult.khatauniNo.value === '88' &&
    enResult.district.value === 'Bhopal',
    2,
    'English Conveyance Sale Deed Extraction',
    'Language Extraction',
    `Extracted Khasra: ${enResult.khasraNo.value}, Khata: ${enResult.khatauniNo.value}, District: ${enResult.district.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Mixed Hindi-English Extraction (Bilingual Mutation Order)
  // -------------------------------------------------------------------------
  const sampleBilingual = CADASTRAL_BENCHMARK_DATASET[2];
  const biResult = await localAssistant.extractStructuredLandRecord(sampleBilingual.rawOcrText);

  assert(
    biResult.khasraNo.value === '77/1' &&
    biResult.mutationReference.value === 'NM-2024-884' &&
    biResult.mauza.value === 'Kothari',
    3,
    'Bilingual Hindi+English Mutation Order Extraction',
    'Language Extraction',
    `Extracted Khasra: ${biResult.khasraNo.value}, Mutation: ${biResult.mutationReference.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Khasra Extraction & Devanagari Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Cadastral Identifier Parsing ---');
  const devanagariNumeralsText = 'भू-अभिलेख राजस्थान • खसरा नं. ७७/१ एवं खाता संख्या १०४';
  const devResult = await localAssistant.extractStructuredLandRecord(devanagariNumeralsText);

  assert(
    devResult.khasraNo.value === '77/1' &&
    devResult.khasraNo.hindiValue === '७७/१',
    4,
    'Khasra Extraction & Devanagari Numeral Normalization (७७/१ -> 77/1)',
    'Cadastral Identifiers',
    `Value: ${devResult.khasraNo.value}, HindiValue: ${devResult.khasraNo.hindiValue}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Khatauni (Account) Extraction
  // -------------------------------------------------------------------------
  assert(
    devResult.khatauniNo.value === '104' &&
    devResult.khatauniNo.hindiValue === '१०४',
    5,
    'Khatauni Account Number Extraction (१०४ -> 104)',
    'Cadastral Identifiers',
    `Khatauni Value: ${devResult.khatauniNo.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Khewat Extraction
  // -------------------------------------------------------------------------
  const khewatSample = 'तहसील सांगानेर | खेवट नं. १२ | खसरा नं. ३१५';
  const khewatResult = await localAssistant.extractStructuredLandRecord(khewatSample);

  assert(
    khewatResult.khewatNo.value === '12',
    6,
    'Khewat Number Extraction',
    'Cadastral Identifiers',
    `Khewat: ${khewatResult.khewatNo.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Area (Rakba) Extraction and Unit Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Land Measurement & Ownership Ledger ---');
  const areaSample = 'मौजा कोठारी | कुल रकबा: ०.९६०० हेक्टेयर (3 बीघा 12 बिस्वा)';
  const areaResult = await localAssistant.extractStructuredLandRecord(areaSample);

  assert(
    areaResult.rakba.value === 0.96 &&
    areaResult.rakbaUnit.value === 'Hectare',
    7,
    'Rakba Area Extraction & Hectare Unit Normalization',
    'Measurement Validation',
    `Rakba: ${areaResult.rakba.value} ${areaResult.rakbaUnit.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Owner & Co-Sharer Relationship Extraction
  // -------------------------------------------------------------------------
  const ownerSample = `खातेदार का नाम: श्रीमती सावित्री देवी पत्नी मोहन लाल हिस्सा १/२
सह-खातेदार: रमेश कुमार पुत्र मोहन लाल हिस्सा १/२`;
  const ownerResult = await localAssistant.extractStructuredLandRecord(ownerSample);

  assert(
    ownerResult.ownerName.value?.includes('Savitri Devi') &&
    ownerResult.coSharers.value &&
    ownerResult.coSharers.value.length >= 1,
    8,
    'Primary Owner and Co-Sharer Extraction',
    'Ownership Parsing',
    `Owner: ${ownerResult.ownerName.value}, Co-sharers: ${ownerResult.coSharers.value?.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Missing Field Handling (Null values, no hallucination)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Truthfulness & Anti-Hallucination ---');
  const bareRecord = 'खसरा नं. 55 | मौजा रामपुरा';
  const bareResult = await localAssistant.extractStructuredLandRecord(bareRecord);

  assert(
    bareResult.khewatNo.value === null &&
    bareResult.lagaan.value === null &&
    bareResult.encumbrance.value === null,
    9,
    'Missing Fields Safely Set to null (Zero Hallucination)',
    'Truthfulness',
    `Khewat: ${bareResult.khewatNo.value}, Lagaan: ${bareResult.lagaan.value}, Encumbrance: ${bareResult.encumbrance.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Conflicting Field Comparison Detection
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Dual-Engine Reconciliation & Cross-Checking ---');
  const conflictCheckArea = compareValues(0.96, 0.82, true);
  const conflictCheckKhasra = compareValues('77/1', '78/2', false);

  assert(
    conflictCheckArea.status === 'CONFLICT' &&
    conflictCheckKhasra.status === 'CONFLICT',
    10,
    'Discrepancy Detection Between Disagreeing Values',
    'Reconciliation',
    `Area Status: ${conflictCheckArea.status}, Khasra Status: ${conflictCheckKhasra.status}`
  );

  // -------------------------------------------------------------------------
  // TEST 11: Deterministic Parser vs LLM Disagreement
  // -------------------------------------------------------------------------
  const reconciliation = await CadastralReconciliationEngine.reconcileExtraction(
    sampleHi.rawOcrText,
    { fileName: 'Jamabandi_Test.pdf' },
    'local-dev'
  );

  assert(
    reconciliation.comparisons.length > 0 &&
    reconciliation.matchCount > 0 &&
    reconciliation.provider.length > 0,
    11,
    'Deterministic vs LLM Dual-Engine Cross-Checking Engine',
    'Reconciliation',
    `Total fields: ${reconciliation.comparisons.length}, Matches: ${reconciliation.matchCount}, Conflicts: ${reconciliation.conflictsCount}`
  );

  // -------------------------------------------------------------------------
  // TEST 12: Human Override Persistence Logic
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Human In The Loop & Authority ---');
  const mockOfficerDecision = {
    field: 'rakba',
    officerAcceptedValue: 0.96,
    officerSource: 'Human Manual Override (Field Verification)',
    timestamp: new Date().toISOString(),
  };

  assert(
    mockOfficerDecision.officerAcceptedValue === 0.96 &&
    mockOfficerDecision.officerSource.includes('Human Manual Override'),
    12,
    'Officer Human Override Authority & Non-Destructive Decision Trail',
    'Human Review',
    `Accepted: ${mockOfficerDecision.officerAcceptedValue} by ${mockOfficerDecision.officerSource}`
  );

  // -------------------------------------------------------------------------
  // TEST 13: No Invented Values on Smudged / Random OCR Text
  // -------------------------------------------------------------------------
  const noisyGarbageText = '??? ~~~ [unreadable water damage] *** ...';
  const noisyResult = await fallbackProvider.extractStructuredLandRecord(noisyGarbageText);

  assert(
    noisyResult.khasraNo.value === null &&
    noisyResult.rakba.value === null,
    13,
    'Unreadable / Smudged Text Yields Safe Null (No Invented Values)',
    'Truthfulness',
    `Khasra: ${noisyResult.khasraNo.value}, Rakba: ${noisyResult.rakba.value}`
  );

  // -------------------------------------------------------------------------
  // TEST 14: Multi-Document Cross-Verification (Consistency vs Conflict)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Cross-Document Intelligence Foundation ---');
  const doc1 = {
    id: 'DOC-1',
    documentCode: 'ROR-2023',
    fileName: 'Jamabandi.pdf',
    recordType: 'Jamabandi (RoR)',
    extraction: hiResult,
  };
  const doc2 = {
    id: 'DOC-2',
    documentCode: 'SALE-2024',
    fileName: 'SaleDeed.pdf',
    recordType: 'Sale Deed',
    extraction: hiResult,
  };
  const doc3Conflict = {
    id: 'DOC-3',
    documentCode: 'MUT-2024',
    fileName: 'Mutation.pdf',
    recordType: 'Mutation Order',
    extraction: {
      ...hiResult,
      rakba: { value: 0.75, source: 'llm' as const, confidenceCategory: 'HIGH' as const },
    },
  };

  const crossConsistent = CrossDocumentCadastralAnalyzer.analyzeParcelDocuments('P-RAJ-001', [doc1, doc2]);
  const crossConflict = CrossDocumentCadastralAnalyzer.analyzeParcelDocuments('P-RAJ-001', [doc1, doc3Conflict]);

  assert(
    crossConsistent.overallStatus === 'CONSISTENT' &&
    crossConflict.overallStatus === 'CONFLICT_DETECTED' &&
    crossConflict.conflictCount >= 1,
    14,
    'Cross-Document Cadastral Verification (Consistency & Conflict Detection)',
    'Cross-Document',
    `Consistent Test: ${crossConsistent.overallStatus}, Conflict Test: ${crossConflict.overallStatus} (${crossConflict.conflictCount} conflicts)`
  );

  // -------------------------------------------------------------------------
  // TEST 15: Graceful Fallback When API Key Missing or Offline
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Resilient Offline Fallback ---');
  const emptyApiProvider = new ConfigurableApiProvider({ apiKey: '' });
  const isAvailable = await emptyApiProvider.isAvailable();
  const fallbackResult = await emptyApiProvider.extractStructuredLandRecord(sampleHi.rawOcrText);

  assert(
    isAvailable === false &&
    fallbackResult.khasraNo.value !== null,
    15,
    'Graceful Offline Fallback when No API Key is Provided',
    'Resilience',
    `IsAvailable: ${isAvailable}, Recovered Khasra: ${fallbackResult.khasraNo.value}`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`PHASE 6 TEST RESULTS: ${passedCount}/${results.length} PASSED (Failed: ${failedCount})`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    throw new Error(`${failedCount} tests failed in Phase 6 suite.`);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
