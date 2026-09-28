/**
 * DHAROHAR - Cadastral Ground-Truth & Domain Training Dataset Structure
 * Phase 6: Training / Dataset Preparation Foundation
 * 
 * Defines schema and curation format for fine-tuning Indic cadastral intelligence models.
 * Contains explicitly labelled demonstration benchmark samples for regression testing.
 * NOTE: No model has been trained or fine-tuned; this is the structured format foundation.
 */

import { CadastralExtractionTrainingSample } from '../services/llm/types';

export const CADASTRAL_BENCHMARK_DATASET: CadastralExtractionTrainingSample[] = [
  {
    sampleId: 'BENCHMARK-HI-ROR-001',
    documentType: 'Jamabandi (Record of Rights)',
    language: 'hi',
    rawOcrText: `राजस्व मण्डल राजस्थान - ई-धरती जमाबंदी प्रति
ज़िला: जयपुर | तहसील: सांगानेर | पटवार मण्डल: कोठारी (संवत २०८०)
खाता संख्या (खतौनी): १०४ | खेवट संख्या: १२
खसरा नं: ७७/१ | रकबा: ०.९६ हेक्टेयर (३ बीघा १२ बिस्वा)
भूमि किस्म: बारानी प्रथम (कृषि)
खातेदार: श्रीमती सावित्री देवी पत्नी श्री मोहन लाल (हिस्सा १/२)
सह-खातेदार: श्री रमेश कुमार पुत्र श्री मोहन लाल (हिस्सा १/२)
लगान: रु. ४५.५० | नामांतरण सं.: २०१/२०२३
भार/रहन: कोई प्रविष्टि नहीं`,
    groundTruthStructured: {
      khasraNo: { value: '77/1', hindiValue: '७७/१', source: 'human', confidenceCategory: 'HIGH' },
      khatauniNo: { value: '104', hindiValue: '१०४', source: 'human', confidenceCategory: 'HIGH' },
      khewatNo: { value: '12', hindiValue: '१२', source: 'human', confidenceCategory: 'HIGH' },
      mauza: { value: 'Kothari', hindiValue: 'कोठारी', source: 'human', confidenceCategory: 'HIGH' },
      patwarCircle: { value: 'Kothari', hindiValue: 'कोठारी', source: 'human', confidenceCategory: 'HIGH' },
      tehsil: { value: 'Sanganer', hindiValue: 'सांगानेर', source: 'human', confidenceCategory: 'HIGH' },
      district: { value: 'Jaipur', hindiValue: 'जयपुर', source: 'human', confidenceCategory: 'HIGH' },
      settlementYear: { value: '2080', hindiValue: '२०८०', source: 'human', confidenceCategory: 'HIGH' },
      landClassification: { value: 'Barani-I (Rainfed Agriculture)', hindiValue: 'बारानी प्रथम', source: 'human', confidenceCategory: 'HIGH' },
      rakba: { value: 0.96, source: 'human', confidenceCategory: 'HIGH' },
      rakbaUnit: { value: 'Hectare', source: 'human', confidenceCategory: 'HIGH' },
      ownerName: { value: 'Savitri Devi', hindiValue: 'सावित्री देवी', source: 'human', confidenceCategory: 'HIGH' },
      lagaan: { value: '45.50', source: 'human', confidenceCategory: 'HIGH' },
      mutationReference: { value: '201/2023', source: 'human', confidenceCategory: 'HIGH' },
    },
    knownAmbiguities: [
      'Devanagari numeral transliteration (७७/१ -> 77/1)',
      'Dual area specification (0.96 Hectares vs 3 Bigha 12 Biswa)',
    ],
    notes: 'Demonstration Benchmark Sample 1 - Standard Devanagari Record of Rights with two equal co-sharers.',
  },
  {
    sampleId: 'BENCHMARK-EN-DEED-002',
    documentType: 'Registered Sale Deed (बैनामा)',
    language: 'en',
    rawOcrText: `GOVERNMENT OF MADHYA PRADESH - REGISTRATION DEPARTMENT
REGISTERED SALE CONVEYANCE DEED
District: Bhopal | Tehsil: Huzur | Village / Mauza: Berasia
Khasra No: 142/3 | Khatauni Account No: 88 | Khewat: 5
Total Land Area: 1.4500 Hectares (Barani Agriculture Land)
Vendor / Transferor: Shri Rajesh Patel S/o Late Ramdas Patel
Purchaser / Transferee: Smt. Sunita Sharma W/o Shri Alok Sharma
Revenue Assessment (Lagaan): Rs. 72.00
Encumbrance: Clear title, no active bank hypothecation recorded.
Registered on 14/11/2024 under Deed No: 2024/MP/7891`,
    groundTruthStructured: {
      khasraNo: { value: '142/3', source: 'human', confidenceCategory: 'HIGH' },
      khatauniNo: { value: '88', source: 'human', confidenceCategory: 'HIGH' },
      khewatNo: { value: '5', source: 'human', confidenceCategory: 'HIGH' },
      mauza: { value: 'Berasia', source: 'human', confidenceCategory: 'HIGH' },
      tehsil: { value: 'Huzur', source: 'human', confidenceCategory: 'HIGH' },
      district: { value: 'Bhopal', source: 'human', confidenceCategory: 'HIGH' },
      landClassification: { value: 'Barani Agriculture Land', source: 'human', confidenceCategory: 'HIGH' },
      rakba: { value: 1.45, source: 'human', confidenceCategory: 'HIGH' },
      rakbaUnit: { value: 'Hectare', source: 'human', confidenceCategory: 'HIGH' },
      ownerName: { value: 'Sunita Sharma', source: 'human', confidenceCategory: 'HIGH' },
      lagaan: { value: '72.00', source: 'human', confidenceCategory: 'HIGH' },
      documentDate: { value: '14/11/2024', source: 'human', confidenceCategory: 'HIGH' },
    },
    knownAmbiguities: [
      'Vendor vs Purchaser role disambiguation (Purchaser is the new titular owner)',
    ],
    notes: 'Demonstration Benchmark Sample 2 - English conveyance deed with explicit vendor/purchaser distinction.',
  },
  {
    sampleId: 'BENCHMARK-BI-MUTATION-003',
    documentType: 'Mutation Order (दाखिल-खारिज / नामांतरण)',
    language: 'hi+en',
    rawOcrText: `कार्यालय तहसीलदार - सांगानेर (राजस्व शाखा)
ORDER OF MUTATION / नामांतरण आदेश संख्या: NM-2024-884
मौजा / Village: Kothari | Halka Patwar: 04
Sub-division of Khasra No. 77:
Original Khasra 77/1 (Area 0.96 ha) mutated into:
- 77/1-A: 0.50 Hectare in favor of Savitri Devi
- 77/1-B: 0.46 Hectare in favor of Ramesh Kumar
Approved pursuant to Partition Decree / बंटवारा आदेश dt 10-Jan-2024`,
    groundTruthStructured: {
      khasraNo: { value: '77/1', source: 'human', confidenceCategory: 'HIGH' },
      mauza: { value: 'Kothari', hindiValue: 'कोठारी', source: 'human', confidenceCategory: 'HIGH' },
      tehsil: { value: 'Sanganer', hindiValue: 'सांगानेर', source: 'human', confidenceCategory: 'HIGH' },
      rakba: { value: 0.96, source: 'human', confidenceCategory: 'HIGH' },
      rakbaUnit: { value: 'Hectare', source: 'human', confidenceCategory: 'HIGH' },
      mutationReference: { value: 'NM-2024-884', source: 'human', confidenceCategory: 'HIGH' },
      documentType: { value: 'Mutation Order (दाखिल-खारिज)', source: 'human', confidenceCategory: 'HIGH' },
    },
    knownAmbiguities: [
      'Bilingual header and terminology',
      'Partition sub-division listing (77/1-A and 77/1-B) linked to parent Khasra 77/1',
    ],
    notes: 'Demonstration Benchmark Sample 3 - Bilingual mutation order depicting parcel subdivision.',
  },
];
