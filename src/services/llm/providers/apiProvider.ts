/**
 * DHAROHAR - Configurable API LLM Provider
 * 
 * Supports external Gemini / OpenAI compatible REST APIs for structured land record extraction.
 * Safe fallback on network failure, missing key, invalid JSON, or rate limit.
 * Never leaks keys or hardcodes credentials.
 */

import { LLMProvider } from './baseProvider';
import { LandRecordStructuredExtraction } from '../types';
import { LAND_RECORD_SYSTEM_PROMPT, LAND_RECORD_EXTRACTION_SCHEMA_JSON } from '../prompts';
import { LocalIndicAssistantProvider } from './localMockProvider';

export interface ApiProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
}

export class ConfigurableApiProvider implements LLMProvider {
  name = 'Connected Indic AI (API)';
  type = 'api-connected' as const;
  description = 'Cloud-assisted LLM endpoint for Indic land records with strict cadastral schema adherence.';

  private config: ApiProviderConfig;
  private fallbackProvider: LocalIndicAssistantProvider;

  constructor(config?: ApiProviderConfig) {
    this.config = {
      apiKey: config?.apiKey || (typeof process !== 'undefined' ? process.env?.VITE_GEMINI_API_KEY : undefined),
      baseUrl: config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      modelName: config?.modelName || 'gemini-1.5-flash',
      timeoutMs: config?.timeoutMs || 10000,
    };
    this.fallbackProvider = new LocalIndicAssistantProvider();
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 5);
  }

  async extractStructuredLandRecord(
    ocrText: string,
    metadata?: any
  ): Promise<LandRecordStructuredExtraction> {
    if (!this.config.apiKey) {
      // Gracefully fall back to intelligent local assistant if no external key is provided
      console.info('[DHAROHAR LLM] No external API key found. Using intelligent local Indic intelligence.');
      return this.fallbackProvider.extractStructuredLandRecord(ocrText, metadata);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const promptPayload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${LAND_RECORD_SYSTEM_PROMPT}\n\nStrict Output JSON Schema Reference:\n${LAND_RECORD_EXTRACTION_SCHEMA_JSON}\n\nDocument Metadata: ${JSON.stringify(metadata || {})}\n\nRAW OCR TEXT TO EXTRACT:\n"""\n${ocrText}\n"""\n\nReturn ONLY the structured JSON matching the schema:`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        }
      };

      const url = `${this.config.baseUrl}/models/${this.config.modelName}:generateContent?key=${this.config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptPayload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`LLM API responded with HTTP status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Empty response from LLM endpoint');
      }

      const parsedJson = JSON.parse(rawText);
      return this.sanitizeStructuredExtraction(parsedJson, ocrText);
    } catch (err: any) {
      console.warn('[DHAROHAR LLM] API call failed or timed out. Falling back to local assistant:', err.message);
      return this.fallbackProvider.extractStructuredLandRecord(ocrText, metadata);
    }
  }

  private sanitizeStructuredExtraction(raw: any, ocrText: string): LandRecordStructuredExtraction {
    const wrap = (val: any, defaultUnit?: string) => {
      if (!val || typeof val !== 'object') {
        return {
          value: val || null,
          evidence: null,
          source: 'llm' as const,
          confidenceCategory: val ? ('HIGH' as const) : ('NEEDS_REVIEW' as const),
        };
      }
      return {
        value: val.value !== undefined ? val.value : null,
        hindiValue: val.hindiValue || null,
        evidence: val.evidence || null,
        source: 'llm' as const,
        confidenceCategory: val.confidenceCategory || (val.value ? 'HIGH' : 'NEEDS_REVIEW'),
        isAmbiguous: Boolean(val.isAmbiguous),
      };
    };

    return {
      khasraNo: wrap(raw.khasraNo),
      khatauniNo: wrap(raw.khatauniNo),
      khewatNo: wrap(raw.khewatNo),
      mauza: wrap(raw.mauza),
      patwarCircle: wrap(raw.patwarCircle),
      tehsil: wrap(raw.tehsil),
      district: wrap(raw.district),
      settlementYear: wrap(raw.settlementYear),
      landClassification: wrap(raw.landClassification),
      rakba: {
        value: typeof raw.rakba?.value === 'number' ? raw.rakba.value : (Number(raw.rakba?.value) || null),
        evidence: raw.rakba?.evidence || null,
        source: 'llm',
        confidenceCategory: raw.rakba?.value ? 'HIGH' : 'NEEDS_REVIEW',
      },
      rakbaUnit: wrap(raw.rakbaUnit || { value: 'Hectare' }),
      rakbaBighaBiswa: wrap(raw.rakbaBighaBiswa),
      ownerName: wrap(raw.ownerName),
      coSharers: wrap(raw.coSharers || []),
      ownershipShares: wrap(raw.ownershipShares),
      lagaan: wrap(raw.lagaan),
      encumbrance: wrap(raw.encumbrance),
      mutationReference: wrap(raw.mutationReference),
      inheritanceReference: wrap(raw.inheritanceReference),
      documentType: wrap(raw.documentType),
      documentDate: wrap(raw.documentDate),
      evidenceText: ocrText.slice(0, 300),
    };
  }
}
