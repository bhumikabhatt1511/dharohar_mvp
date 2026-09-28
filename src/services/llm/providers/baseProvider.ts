/**
 * DHAROHAR - Base LLM Provider Interface
 */

import { LandRecordStructuredExtraction, ProviderType } from '../types';

export interface LLMProvider {
  name: string;
  type: ProviderType;
  description: string;
  isAvailable(): Promise<boolean>;
  extractStructuredLandRecord(
    ocrText: string,
    metadata?: {
      fileName?: string;
      recordType?: string;
      district?: string;
      tehsil?: string;
      village?: string;
    }
  ): Promise<LandRecordStructuredExtraction>;
}
