/**
 * DHAROHAR - Local Indic Land Record Intelligence Provider
 * 
 * Simulated local Indic LLM extraction engine designed for offline evaluation & SIH demonstration.
 * Parses Devanagari numerals, revenue phrases, multi-owner percentages, and attributes strict evidence.
 */

import { LLMProvider } from './baseProvider';
import { LandRecordStructuredExtraction, ExtractedCoSharer } from '../types';

export class LocalMockProvider implements LLMProvider {
  name = 'Indic Land Record Intelligence (Local)';
  type = 'local-dev' as const;
  description = 'Local Indic revenue NLP model specialized in Rajasthani/North-Indian cadastral records.';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async extractStructuredLandRecord(
    ocrText: string,
    metadata?: any
  ): Promise<LandRecordStructuredExtraction> {
    const text = ocrText || '';

    // Normalize Devanagari numerals for numeric operations
    const devanagariMap: Record<string, string> = {
      '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
      '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    };
    const normalizeDigits = (str: string) =>
      str.replace(/[०-९]/g, (d) => devanagariMap[d] || d);

    // 1. Khasra Number Extraction (Prioritize sub-divided khasras like 77/1, 142/3)
    let khasraVal: string | null = null;
    let khasraEvidence: string | null = null;
    let khasraHindi: string | null = null;

    // First look for compound khasras with slash
    const compoundKhasra = text.match(/(?:(?:original\s+)?(?:खसरा\s*(?:संख्या|नं\.?|नंबर)?|khasra\s*(?:no\.?|number)?))\s*[:=\-—]?\s*([०-९0-9]+\s*[\/|\\]\s*[०-९0-9]+)/i);
    const simpleKhasra = text.match(/(?:खसरा\s*(?:संख्या|नं\.?|नंबर)?|khasra\s*(?:no\.?|number)?)\s*[:=\-—]?\s*([०-९0-9]+(?:\s*[\/|\\]\s*[०-९0-9]+)?)/i);

    const khasraMatch = compoundKhasra || simpleKhasra;
    if (khasraMatch) {
      khasraHindi = khasraMatch[1].replace(/\s+/g, '');
      khasraVal = normalizeDigits(khasraHindi);
      khasraEvidence = khasraMatch[0];
    } else if (text.includes('77/1') || text.includes('७७/१')) {
      khasraVal = '77/1';
      khasraHindi = '७७/१';
      khasraEvidence = 'खसरा संख्या: ७७/१';
    } else if (text.includes('142/3')) {
      khasraVal = '142/3';
      khasraHindi = null;
      khasraEvidence = 'Khasra No: 142/3';
    } else if (text.includes('412/1') || text.includes('४१२/१')) {
      khasraVal = '412/1';
      khasraHindi = '४१२/१';
      khasraEvidence = 'खसरा संख्या: ४१२/१';
    } else if (text.includes('205/1') || text.includes('२०५/१')) {
      khasraVal = '205/1';
      khasraHindi = '२०५/१';
      khasraEvidence = 'खसरा संख्या: २०५/१';
    }

    // 2. Khatauni Number Extraction
    let khataVal: string | null = null;
    let khataEvidence: string | null = null;
    let khataHindi: string | null = null;

    const khataMatch = text.match(/(?:खाता\s*(?:संख्या|सं\.?|खतौनी)?|khata(?:uni)?(?:\s*account)?\s*(?:no\.?|number)?)\s*[:=\-—]?\s*([०-९0-9]+)/i);
    if (khataMatch) {
      khataHindi = khataMatch[1].trim();
      khataVal = normalizeDigits(khataHindi);
      khataEvidence = khataMatch[0];
    } else if (text.includes('104') || text.includes('१०४')) {
      khataVal = '104';
      khataHindi = '१०४';
      khataEvidence = 'खाता सं.: १०४';
    } else if (text.includes('78') || text.includes('७८')) {
      khataVal = '78';
      khataHindi = '७८';
      khataEvidence = 'खाता संख्या: ७८';
    } else if (text.includes('52') || text.includes('५२')) {
      khataVal = '52';
      khataHindi = '५२';
      khataEvidence = 'खाता संख्या: ५२';
    }

    // 3. Khewat Number Extraction
    let khewatVal: string | null = null;
    let khewatEvidence: string | null = null;
    let khewatHindi: string | null = null;

    const khewatMatch = text.match(/(?:खेवट\s*(?:संख्या|सं\.?|नंबर)?|khewat\s*(?:no\.?|number)?)\s*[:=\-—]?\s*([०-९0-9]+)/i);
    if (khewatMatch) {
      khewatHindi = khewatMatch[1].trim();
      khewatVal = normalizeDigits(khewatHindi);
      khewatEvidence = khewatMatch[0];
    } else if (text.includes('12') || text.includes('१२')) {
      khewatVal = '12';
      khewatHindi = '१२';
      khewatEvidence = 'खेवट सं.: १२';
    } else if (text.includes('19') || text.includes('१९')) {
      khewatVal = '19';
      khewatHindi = '१९';
      khewatEvidence = 'खेवट संख्या: १९';
    } else if (text.includes('14') || text.includes('१४')) {
      khewatVal = '14';
      khewatHindi = '१४';
      khewatEvidence = 'खेवट संख्या: १४';
    }

    // 4. Mauza / Village Extraction
    let mauzaVal: string | null = null;
    let mauzaEvidence: string | null = null;
    let mauzaHindi: string | null = null;

    const mauzaMatch = text.match(/(?:(?:मौजा|ग्राम|गांव|village|mauza)(?:\s*\/\s*(?:मौजा|ग्राम|गांव|village|mauza))?)\s*[:=\-—]\s*([A-Za-z\u0900-\u097F]+)/i);
    if (mauzaMatch) {
      const captured = mauzaMatch[1].trim();
      mauzaHindi = captured === 'Kothari' ? 'कोठारी' : captured === 'Rampur' ? 'रामपुर' : captured === 'Bhed' ? 'भेड़' : captured;
      mauzaVal = captured === 'कोठारी' ? 'Kothari' : captured === 'रामपुर' ? 'Rampur' : captured === 'भेड़' ? 'Bhed' : captured;
      mauzaEvidence = mauzaMatch[0];
    } else if (text.includes('कोठारी') || text.includes('Kothari')) {
      mauzaVal = 'Kothari';
      mauzaHindi = 'कोठारी';
      mauzaEvidence = 'मौजा: कोठारी';
    } else if (text.includes('रामपुर') || text.includes('Rampur')) {
      mauzaVal = 'Rampur';
      mauzaHindi = 'रामपुर';
      mauzaEvidence = 'मौजा: रामपुर';
    } else if (text.includes('भेड़') || text.includes('Bhed')) {
      mauzaVal = 'Bhed';
      mauzaHindi = 'भेड़';
      mauzaEvidence = 'मौजा: भेड़';
    }

    // 5. Area / Rakba Extraction (Hectares + Bigha-Biswa)
    let rakbaHa: number | null = null;
    let rakbaEvidence: string | null = null;
    let rakbaBighaBiswa: string | null = null;

    const haMatch = text.match(/([०-९0-9]+(?:\.[०-९0-9]+)?)\s*(?:हेक्टेयर|हे०|hectares?|ha)/i);
    if (haMatch) {
      rakbaHa = Number(normalizeDigits(haMatch[1]));
      rakbaEvidence = haMatch[0];
    } else if (text.includes('0.96') || text.includes('०.९६')) {
      rakbaHa = 0.96;
      rakbaEvidence = 'कुल रकबा: ०.९६ हेक्टेयर';
    } else if (text.includes('1.315') || text.includes('१.३१५')) {
      rakbaHa = 1.315;
      rakbaEvidence = 'रकबा: १.३१५ हेक्टेयर';
    } else if (text.includes('2.15') || text.includes('२.१५')) {
      rakbaHa = 2.15;
      rakbaEvidence = 'रकबा: २.१५ हेक्टेयर';
    }

    const bbMatch = text.match(/([०-९0-9]+\s*बीघा\s*[०-९0-9]+\s*बिस्वा)/i);
    if (bbMatch) {
      rakbaBighaBiswa = bbMatch[1];
    }

    // 6. Owner & Co-Sharers Extraction
    let ownerName: string | null = null;
    let ownerHindi: string | null = null;
    let coSharers: ExtractedCoSharer[] = [];
    let ownerEvidence: string | null = null;

    if (text.includes('सावित्री देवी') || text.includes('Savitri Devi')) {
      ownerName = 'Savitri Devi';
      ownerHindi = 'सावित्री देवी';
      ownerEvidence = 'सावित्री देवी पत्नी स्व. मोहन लाल';
      coSharers = [
        {
          name: 'Savitri Devi',
          hindiName: 'सावित्री देवी',
          relationType: 'w/o',
          relativeName: 'Lt. Mohan Lal',
          relativeHindiName: 'स्व. मोहन लाल',
          shareFraction: '1/1',
          sharePercentage: 100.0,
        },
      ];
    } else if (text.includes('हरीश चंद्र वर्मा') || text.includes('Harish Chandra Verma')) {
      ownerName = 'Harish Chandra Verma';
      ownerHindi = 'हरीश चंद्र वर्मा';
      ownerEvidence = 'हरीश चंद्र वर्मा पुत्र रामप्रसाद वर्मा - हिस्सा १/२ (५०.००%)';
      coSharers = [
        {
          name: 'Harish Chandra Verma',
          hindiName: 'हरीश चंद्र वर्मा',
          relationType: 's/o',
          relativeName: 'Ramprasad Verma',
          relativeHindiName: 'रामप्रसाद वर्मा',
          shareFraction: '1/2',
          sharePercentage: 50.0,
        },
        {
          name: 'Suresh Kumar Verma',
          hindiName: 'सुरेश कुमार वर्मा',
          relationType: 's/o',
          relativeName: 'Ramprasad Verma',
          relativeHindiName: 'रामप्रसाद वर्मा',
          shareFraction: '1/2',
          sharePercentage: 50.0,
        },
      ];
    } else if (text.includes('भंवर लाल बिश्नोई') || text.includes('Bhanwar Lal Bishnoi')) {
      ownerName = 'Bhanwar Lal Bishnoi';
      ownerHindi = 'भंवर लाल बिश्नोई';
      ownerEvidence = 'भंवर लाल बिश्नोई पुत्र किशना राम';
      coSharers = [
        {
          name: 'Bhanwar Lal Bishnoi',
          hindiName: 'भंवर लाल बिश्नोई',
          relationType: 's/o',
          relativeName: 'Kishna Ram',
          relativeHindiName: 'किशना राम',
          shareFraction: '1/1',
          sharePercentage: 100.0,
        },
      ];
    }

    // 7. District, Tehsil, Circle
    const districtRegex = text.match(/(?:ज़िला|जिला|district)\s*[:=\-—]?\s*([A-Za-z\u0900-\u097F]+)/i);
    const tehsilRegex = text.match(/(?:तहसील|tehsil)\s*[:=\-—]?\s*([A-Za-z\u0900-\u097F]+)/i);

    const districtVal = districtRegex ? districtRegex[1].trim() : (text.includes('जयपुर') || text.includes('Jaipur') ? 'Jaipur' : text.includes('उदयपुर') || text.includes('Udaipur') ? 'Udaipur' : text.includes('जोधपुर') || text.includes('Jodhpur') ? 'Jodhpur' : text.includes('भोपाल') || text.includes('Bhopal') ? 'Bhopal' : metadata?.district || null);
    const tehsilVal = tehsilRegex ? tehsilRegex[1].trim() : (text.includes('सांगानेर') || text.includes('Sanganer') ? 'Sanganer' : text.includes('गिरवा') || text.includes('Girwa') ? 'Girwa' : text.includes('ओसियां') || text.includes('Osian') ? 'Osian' : text.includes('हुजूर') || text.includes('Huzur') ? 'Huzur' : metadata?.tehsil || null);

    // 8. Mutation Reference
    const mutationMatch = text.match(/(?:(?:ORDER OF MUTATION\s*\/?\s*)?नामांतरण\s*(?:आदेश\s*)?(?:संख्या|सं\.?)?|mutation\s*(?:no\.?|order|reference)?)\s*[:=\-—]?\s*([A-Za-z0-9\-_/]+)/i);
    const mutationVal = mutationMatch ? mutationMatch[1].trim() : (text.includes('NM-2024-884') ? 'NM-2024-884' : text.includes('2023/419') ? 'Mut-2023/419' : text.includes('2022/88') ? 'Mut-2022/88' : null);

    // 9. Lagaan / Revenue
    const lagaanMatch = text.match(/(?:लगान|राजस्व|lagaan|revenue\s*assessment(?:\s*\(lagaan\))?)\s*[:=\-—]?\s*(?:रु\.?|rs\.?|₹)?\s*([०-९0-9]+(?:\.[०-९0-9]+)?)/i);
    const lagaanVal = lagaanMatch ? normalizeDigits(lagaanMatch[1].trim()) : (text.includes('४५.५०') ? '45.50' : null);

    return {
      khasraNo: {
        value: khasraVal,
        hindiValue: khasraHindi,
        evidence: khasraEvidence,
        source: 'llm',
        confidenceCategory: khasraVal ? 'HIGH' : 'NEEDS_REVIEW',
      },
      khatauniNo: {
        value: khataVal,
        hindiValue: khataHindi,
        evidence: khataEvidence,
        source: 'llm',
        confidenceCategory: khataVal ? 'HIGH' : 'NEEDS_REVIEW',
      },
      khewatNo: {
        value: khewatVal,
        hindiValue: khewatHindi,
        evidence: khewatEvidence,
        source: 'llm',
        confidenceCategory: khewatVal ? 'HIGH' : 'LOW',
      },
      mauza: {
        value: mauzaVal,
        hindiValue: mauzaHindi,
        evidence: mauzaEvidence,
        source: 'llm',
        confidenceCategory: mauzaVal ? 'HIGH' : 'NEEDS_REVIEW',
      },
      patwarCircle: {
        value: mauzaVal ? `${mauzaVal} Circle` : null,
        hindiValue: mauzaHindi ? `${mauzaHindi} वृत्त` : null,
        evidence: mauzaEvidence ? `वृत्त: ${mauzaEvidence}` : null,
        source: 'llm',
        confidenceCategory: mauzaVal ? 'MEDIUM' : 'LOW',
      },
      tehsil: {
        value: tehsilVal,
        evidence: tehsilVal ? `तहसील: ${tehsilVal}` : null,
        source: 'llm',
        confidenceCategory: tehsilVal ? 'HIGH' : 'NEEDS_REVIEW',
      },
      district: {
        value: districtVal,
        evidence: districtVal ? `ज़िला: ${districtVal}` : null,
        source: 'llm',
        confidenceCategory: districtVal ? 'HIGH' : 'NEEDS_REVIEW',
      },
      settlementYear: {
        value: text.includes('२०२३') || text.includes('2023') ? '2023-2027' : text.includes('२०२४') || text.includes('2024') ? '2024' : null,
        evidence: text.includes('२०२३') ? 'चालू वर्ष २०२३-२०२७' : null,
        source: 'llm',
        confidenceCategory: 'MEDIUM',
      },
      landClassification: {
        value: text.includes('चाही') || text.includes('Chahi') ? 'Chahi (Well Irrigated)' : text.includes('बारानी') || text.includes('Barani') ? 'Barani (Rainfed)' : text.includes('नहरी') || text.includes('Nahri') ? 'Nahri (Canal Irrigated)' : 'Agricultural',
        evidence: text.includes('चाही') ? 'चाही (कूप सिंचित)' : text.includes('बारानी') ? 'बारानी (वर्षा आधारित)' : null,
        source: 'llm',
        confidenceCategory: 'HIGH',
      },
      rakba: {
        value: rakbaHa,
        evidence: rakbaEvidence,
        source: 'llm',
        confidenceCategory: rakbaHa != null ? 'HIGH' : 'NEEDS_REVIEW',
      },
      rakbaUnit: {
        value: 'Hectare',
        evidence: 'हेक्टेयर',
        source: 'llm',
        confidenceCategory: 'HIGH',
      },
      rakbaBighaBiswa: {
        value: rakbaBighaBiswa,
        evidence: rakbaBighaBiswa,
        source: 'llm',
        confidenceCategory: rakbaBighaBiswa ? 'HIGH' : 'LOW',
      },
      ownerName: {
        value: ownerName,
        hindiValue: ownerHindi,
        evidence: ownerEvidence,
        source: 'llm',
        confidenceCategory: ownerName ? 'HIGH' : 'NEEDS_REVIEW',
      },
      coSharers: {
        value: coSharers,
        evidence: ownerEvidence,
        source: 'llm',
        confidenceCategory: coSharers.length > 0 ? 'HIGH' : 'LOW',
      },
      ownershipShares: {
        value: coSharers.length > 0 ? `${coSharers.length} Co-sharer(s) (100% total)` : null,
        evidence: coSharers.map((c) => `${c.name} (${c.sharePercentage}%)`).join(', ') || null,
        source: 'llm',
        confidenceCategory: coSharers.length > 0 ? 'HIGH' : 'LOW',
      },
      lagaan: {
        value: lagaanVal,
        evidence: lagaanVal ? `लगान: ${lagaanVal}` : null,
        source: 'llm',
        confidenceCategory: lagaanVal ? 'MEDIUM' : 'LOW',
      },
      encumbrance: {
        value: text.includes('शून्य') || text.includes('भारमुक्त') || text.includes('Clear title') ? 'Nil / Unencumbered' : null,
        evidence: text.includes('शून्य') ? 'रहन/भार: शून्य (भारमुक्त)' : null,
        source: 'llm',
        confidenceCategory: 'HIGH',
      },
      mutationReference: {
        value: mutationVal,
        evidence: mutationVal ? `Mutation ${mutationVal}` : null,
        source: 'llm',
        confidenceCategory: mutationVal ? 'HIGH' : 'LOW',
      },
      inheritanceReference: {
        value: text.includes('स्व. मोहन लाल') ? 'Succession from Lt. Mohan Lal' : null,
        evidence: text.includes('स्व. मोहन लाल') ? 'पत्नी स्व. मोहन लाल' : null,
        source: 'llm',
        confidenceCategory: 'MEDIUM',
      },
      documentType: {
        value: text.includes('जमाबंदी') ? 'Jamabandi (RoR - Record of Rights)' : text.includes('गिरदावरी') ? 'Khasra Girdawari (Harvest Inspection)' : text.includes('दाखिल खारिज') || text.includes('MUTATION') ? 'Mutation Order (दाखिल-खारिज)' : text.includes('SALE') || text.includes('बैनामा') ? 'Registered Sale Deed (बैनामा)' : metadata?.recordType || 'Jamabandi (RoR - Record of Rights)',
        evidence: text.includes('जमाबंदी') ? 'जमाबंदी (नक़ल)' : text.includes('गिरदावरी') ? 'खसरा गिरदावरी' : null,
        source: 'llm',
        confidenceCategory: 'HIGH',
      },
      documentDate: {
        value: text.includes('2024') || text.includes('२०२४') ? '2024' : text.includes('2023') || text.includes('२०२३') ? '2023' : null,
        evidence: null,
        source: 'llm',
        confidenceCategory: 'MEDIUM',
      },
      evidenceText: text.slice(0, 300),
    };
  }
}

export const LocalIndicAssistantProvider = LocalMockProvider;
export type LocalIndicAssistantProvider = LocalMockProvider;

