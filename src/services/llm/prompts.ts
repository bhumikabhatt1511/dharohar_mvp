/**
 * DHAROHAR - Indic Cadastral Land Record LLM Prompts & Few-Shot Demonstrations
 * 
 * Instructs Language Models to perform extraction from noisy OCR scans of
 * Indian Land Records (Jamabandi, Khasra Girdawari, Dakhil Kharij/Mutation).
 */

export const LAND_RECORD_SYSTEM_PROMPT = `You are DHAROHAR Land Intelligence, a specialized Indic cadastral information extraction assistant.
Your sole purpose is to extract structured land-record data from raw OCR text transcripts of Indian Revenue Records (e.g., Jamabandi RoR, Khasra Girdawari, Dakhil Kharij Mutation registers).

STRICT OPERATIONAL RULES:
1. FACTUAL GROUNDING: Extract ONLY information explicitly present in the provided OCR text.
2. NO HALLUCINATION: NEVER invent, hallucinate, extrapolate, or guess land record values. If a field is not found in the text, set its "value" to null.
3. EVIDENCE ATTRIBUTION: For every extracted field, include the exact substring from the OCR text as "evidence".
4. CADASTRAL TERMINOLOGY:
   - Khasra No (खसरा संख्या / सर्वे नं.): Individual plot / survey number (e.g., "77/1", "412/1", "205/1").
   - Khatauni / Khata No (खाता संख्या / खतौनी): Tenant/Holding ledger account number (e.g., "104", "78", "52").
   - Khewat No (खेवट संख्या): Proprietary holding number (e.g., "12", "19", "14").
   - Mauza / Village (मौजा / ग्राम): Revenue village name (e.g., "Kothari", "Rampur", "Bhed").
   - Patwar Circle (पटवार मण्डल / वृत्त): Local administrative revenue circle.
   - Tehsil (तहसील) & District (ज़िला): Administrative jurisdictions.
   - Rakba / Area (रकबा / क्षेत्रफल): Land area in Hectares or Bigha-Biswa. Convert Bigha-Biswa to decimal Hectares if standard ratios are evident (1 Hectare ≈ 3.95 Bigha in Rajasthan).
   - Co-sharers (सह-खातेदार): Multiple land owners with individual percentage shares (e.g., 50% each for 1/2 share).
5. DEVANAGARI NUMERALS: Recognize Devanagari numerals (०=0, १=1, २=2, ३=3, ४=4, ५=5, ६=6, ७=7, ८=8, ९=9).
6. AMBIGUITY FLAG: If OCR text has conflicting or garbled values, set "isAmbiguous": true and describe the ambiguity in "evidence".
7. LEGAL BOUNDARY: Never make legal ownership determinations. You are an extraction assistant; final legal verification is conducted by a human revenue officer.

OUTPUT FORMAT:
Return a single, valid JSON object matching the requested schema. Do NOT enclose in markdown backticks or commentary.`;

export const FEW_SHOT_DEMONSTRATIONS = [
  {
    title: 'Demo Example 1: Jamabandi (RoR - Record of Rights) in Devanagari Hindi',
    inputOcrText: `राजस्थान सरकार - राजस्व मण्डल अजमेर
जमाबंदी (नक़ल) चालू वर्ष २०२३-२०२७
मौजा: रामपुर | पटवार वृत्त: रामपुर दक्षिण | तहसील: सांगानेर | ज़िला: जयपुर
खेवट संख्या: १९ | खाता संख्या: ७८ | खसरा संख्या: ४१२/१
रकबा: ५ बीघा ४ बिस्वा (१.३१५ हेक्टेयर) | भूमि वर्गीकरण: चाही (कूप सिंचित)
खातेदार का नाम:
१. हरीश चंद्र वर्मा पुत्र रामप्रसाद वर्मा - हिस्सा १/२ (५०.००%)
२. सुरेश कुमार वर्मा पुत्र रामप्रसाद वर्मा - हिस्सा १/२ (५०.००%)
लगान: रु. ४५.५० वार्षिक | रहन/भार: शून्य (भारमुक्त)`,
    expectedOutput: {
      khasraNo: { value: '412/1', hindiValue: '४१२/१', evidence: 'खसरा संख्या: ४१२/१', source: 'llm', confidenceCategory: 'HIGH' },
      khatauniNo: { value: '78', hindiValue: '७८', evidence: 'खाता संख्या: ७८', source: 'llm', confidenceCategory: 'HIGH' },
      khewatNo: { value: '19', hindiValue: '१९', evidence: 'खेवट संख्या: १९', source: 'llm', confidenceCategory: 'HIGH' },
      mauza: { value: 'Rampur', hindiValue: 'रामपुर', evidence: 'मौजा: रामपुर', source: 'llm', confidenceCategory: 'HIGH' },
      patwarCircle: { value: 'Rampur South', hindiValue: 'रामपुर दक्षिण', evidence: 'पटवार वृत्त: रामपुर दक्षिण', source: 'llm', confidenceCategory: 'HIGH' },
      tehsil: { value: 'Sanganer', hindiValue: 'सांगानेर', evidence: 'तहसील: सांगानेर', source: 'llm', confidenceCategory: 'HIGH' },
      district: { value: 'Jaipur', hindiValue: 'जयपुर', evidence: 'ज़िला: जयपुर', source: 'llm', confidenceCategory: 'HIGH' },
      settlementYear: { value: '2023-2027', hindiValue: '२०२३-२०२७', evidence: 'चालू वर्ष २०२३-२०२७', source: 'llm', confidenceCategory: 'HIGH' },
      landClassification: { value: 'Chahi (Well Irrigated)', hindiValue: 'चाही (कूप सिंचित)', evidence: 'भूमि वर्गीकरण: चाही (कूप सिंचित)', source: 'llm', confidenceCategory: 'HIGH' },
      rakba: { value: 1.315, evidence: '५ बीघा ४ बिस्वा (१.३१५ हेक्टेयर)', source: 'llm', confidenceCategory: 'HIGH' },
      rakbaUnit: { value: 'Hectare', evidence: '१.३१५ हेक्टेयर', source: 'llm', confidenceCategory: 'HIGH' },
      rakbaBighaBiswa: { value: '5 Bigha 4 Biswa', evidence: '५ बीघा ४ बिस्वा', source: 'llm', confidenceCategory: 'HIGH' },
      ownerName: { value: 'Harish Chandra Verma', hindiValue: 'हरीश चंद्र वर्मा', evidence: 'हरीश चंद्र वर्मा पुत्र रामप्रसाद वर्मा', source: 'llm', confidenceCategory: 'HIGH' },
      coSharers: {
        value: [
          { name: 'Harish Chandra Verma', hindiName: 'हरीश चंद्र वर्मा', relationType: 's/o', relativeName: 'Ramprasad Verma', relativeHindiName: 'रामप्रसाद वर्मा', shareFraction: '1/2', sharePercentage: 50.0 },
          { name: 'Suresh Kumar Verma', hindiName: 'सुरेश कुमार वर्मा', relationType: 's/o', relativeName: 'Ramprasad Verma', relativeHindiName: 'रामप्रसाद वर्मा', shareFraction: '1/2', sharePercentage: 50.0 }
        ],
        evidence: '१. हरीश चंद्र वर्मा पुत्र रामप्रसाद वर्मा - हिस्सा १/२ (५०.००%) २. सुरेश कुमार वर्मा पुत्र रामप्रसाद वर्मा - हिस्सा १/२ (५०.००%)',
        source: 'llm',
        confidenceCategory: 'HIGH'
      },
      ownershipShares: { value: '100% (2 Co-sharers @ 50% each)', evidence: 'हिस्सा १/२ (५०.००%)', source: 'llm', confidenceCategory: 'HIGH' },
      lagaan: { value: '45.50 INR/yr', evidence: 'लगान: रु. ४५.५० वार्षिक', source: 'llm', confidenceCategory: 'HIGH' },
      encumbrance: { value: 'Nil / Unencumbered', evidence: 'रहन/भार: शून्य (भारमुक्त)', source: 'llm', confidenceCategory: 'HIGH' },
      mutationReference: { value: null, evidence: null, source: 'llm', confidenceCategory: 'HIGH' },
      inheritanceReference: { value: null, evidence: null, source: 'llm', confidenceCategory: 'HIGH' },
      documentType: { value: 'Jamabandi (RoR - Record of Rights)', evidence: 'जमाबंदी (नक़ल)', source: 'llm', confidenceCategory: 'HIGH' },
      documentDate: { value: '2023', evidence: 'चालू वर्ष २०२३-२०२७', source: 'llm', confidenceCategory: 'HIGH' }
    }
  },
  {
    title: 'Demo Example 2: Khasra Girdawari (Harvest Inspection) in Hindi',
    inputOcrText: `तहसील गिरवा - कार्यालय पटवारी कोठारी
खसरा गिरदावरी - रबी संवत २०८१ (वर्ष २०२४)
मौजा: कोठारी | वृत्त: कोठारी | ज़िला: उदयपुर
खसरा संख्या: ७७/१ | खाता सं.: १०४ | खेवट सं.: १२
कुल रकबा: ०.९६ हेक्टेयर (३ बीघा १६ बिस्वा)
कृषि काश्तकार / खातेदार: सावित्री देवी पत्नी स्व. मोहन लाल (पूर्ण स्वामी - १००%)
काश्त का विवरण: बारानी (वर्षा आधारित) | मुख्य फसल: चना व सरसों
कैफियत / टिप्पणी: मौके पर सीमांकन विवाद लंबित।`,
    expectedOutput: {
      khasraNo: { value: '77/1', hindiValue: '७७/१', evidence: 'खसरा संख्या: ७७/१', source: 'llm', confidenceCategory: 'HIGH' },
      khatauniNo: { value: '104', hindiValue: '१०४', evidence: 'खाता सं.: १०४', source: 'llm', confidenceCategory: 'HIGH' },
      khewatNo: { value: '12', hindiValue: '१२', evidence: 'खेवट सं.: १२', source: 'llm', confidenceCategory: 'HIGH' },
      mauza: { value: 'Kothari', hindiValue: 'कोठारी', evidence: 'मौजा: कोठारी', source: 'llm', confidenceCategory: 'HIGH' },
      patwarCircle: { value: 'Kothari', hindiValue: 'कोठारी', evidence: 'वृत्त: कोठारी', source: 'llm', confidenceCategory: 'HIGH' },
      tehsil: { value: 'Girwa', hindiValue: 'गिरवा', evidence: 'तहसील गिरवा', source: 'llm', confidenceCategory: 'HIGH' },
      district: { value: 'Udaipur', hindiValue: 'उदयपुर', evidence: 'ज़िला: उदयपुर', source: 'llm', confidenceCategory: 'HIGH' },
      settlementYear: { value: '2024', hindiValue: '२०२४', evidence: 'वर्ष २०२४', source: 'llm', confidenceCategory: 'HIGH' },
      landClassification: { value: 'Barani (Rainfed)', hindiValue: 'बारानी (वर्षा आधारित)', evidence: 'काश्त का विवरण: बारानी (वर्षा आधारित)', source: 'llm', confidenceCategory: 'HIGH' },
      rakba: { value: 0.96, evidence: 'कुल रकबा: ०.९६ हेक्टेयर', source: 'llm', confidenceCategory: 'HIGH' },
      rakbaUnit: { value: 'Hectare', evidence: '०.९६ हेक्टेयर', source: 'llm', confidenceCategory: 'HIGH' },
      rakbaBighaBiswa: { value: '3 Bigha 16 Biswa', evidence: '३ बीघा १६ बिस्वा', source: 'llm', confidenceCategory: 'HIGH' },
      ownerName: { value: 'Savitri Devi', hindiValue: 'सावित्री देवी', evidence: 'सावित्री देवी पत्नी स्व. मोहन लाल', source: 'llm', confidenceCategory: 'HIGH' },
      coSharers: {
        value: [
          { name: 'Savitri Devi', hindiName: 'सावित्री देवी', relationType: 'w/o', relativeName: 'Lt. Mohan Lal', relativeHindiName: 'स्व. मोहन लाल', shareFraction: '1/1', sharePercentage: 100.0 }
        ],
        evidence: 'सावित्री देवी पत्नी स्व. मोहन लाल (पूर्ण स्वामी - १००%)',
        source: 'llm',
        confidenceCategory: 'HIGH'
      },
      ownershipShares: { value: '100% (Single Holder)', evidence: 'पूर्ण स्वामी - १००%', source: 'llm', confidenceCategory: 'HIGH' },
      lagaan: { value: null, evidence: null, source: 'llm', confidenceCategory: 'HIGH' },
      encumbrance: { value: null, evidence: null, source: 'llm', confidenceCategory: 'HIGH' },
      mutationReference: { value: null, evidence: null, source: 'llm', confidenceCategory: 'HIGH' },
      inheritanceReference: { value: 'Succession from Lt. Mohan Lal', evidence: 'पत्नी स्व. मोहन लाल', source: 'llm', confidenceCategory: 'MEDIUM' },
      documentType: { value: 'Khasra Girdawari (Harvest Inspection)', evidence: 'खसरा गिरदावरी', source: 'llm', confidenceCategory: 'HIGH' },
      documentDate: { value: '2024', evidence: 'वर्ष २०२४', source: 'llm', confidenceCategory: 'HIGH' }
    }
  }
];

export const LAND_RECORD_EXTRACTION_SCHEMA_JSON = `{
  "khasraNo": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "khatauniNo": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "khewatNo": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "mauza": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "patwarCircle": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "tehsil": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "district": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "settlementYear": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "landClassification": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "rakba": { "value": "number | null", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH|MEDIUM|LOW|NEEDS_REVIEW" },
  "rakbaUnit": { "value": "Hectare | Acre | Bigha", "evidence": "string | null", "source": "llm", "confidenceCategory": "HIGH" },
  "rakbaBighaBiswa": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "ownerName": { "value": "string | null", "hindiValue": "string | null", "evidence": "string | null", "source": "llm" },
  "coSharers": { "value": [ { "name": "string", "hindiName": "string", "relationType": "string", "relativeName": "string", "shareFraction": "string", "sharePercentage": "number" } ], "evidence": "string" },
  "ownershipShares": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "lagaan": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "encumbrance": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "mutationReference": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "inheritanceReference": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "documentType": { "value": "string | null", "evidence": "string | null", "source": "llm" },
  "documentDate": { "value": "string | null", "evidence": "string | null", "source": "llm" }
}`;

export function buildExtractionPrompt(ocrText: string, metadata?: any): string {
  return `${LAND_RECORD_SYSTEM_PROMPT}

DOCUMENT CONTEXT:
File: ${metadata?.fileName || 'Scanned_Record.pdf'}
Type Hint: ${metadata?.recordType || 'Cadastral Document'}
District Hint: ${metadata?.district || 'Rajasthan'}

RAW OCR TRANSCRIPT TO EXTRACT:
"""
${ocrText}
"""

Return only the structured JSON object.`;
}

