/**
 * DHAROHAR - LLM Provider Factory
 * 
 * Instantiates and selects the appropriate intelligence provider based on runtime configuration.
 */

import { LLMProvider } from './baseProvider';
import { DeterministicFallbackProvider } from './deterministicFallbackProvider';
import { LocalIndicAssistantProvider } from './localMockProvider';
import { ConfigurableApiProvider } from './apiProvider';
import { ProviderType } from '../types';

export class LLMProviderFactory {
  private static deterministicInstance: LLMProvider | null = null;
  private static localAssistantInstance: LLMProvider | null = null;
  private static apiInstance: LLMProvider | null = null;

  static getProvider(type?: ProviderType): LLMProvider {
    switch (type) {
      case 'deterministic-fallback':
        if (!this.deterministicInstance) {
          this.deterministicInstance = new DeterministicFallbackProvider();
        }
        return this.deterministicInstance;

      case 'api-connected':
        if (!this.apiInstance) {
          this.apiInstance = new ConfigurableApiProvider();
        }
        return this.apiInstance;

      case 'local-dev':
      default:
        if (!this.localAssistantInstance) {
          this.localAssistantInstance = new LocalIndicAssistantProvider();
        }
        return this.localAssistantInstance;
    }
  }

  static getAvailableProviders(): Array<{ type: ProviderType; name: string; description: string }> {
    return [
      {
        type: 'local-dev',
        name: 'Local Indic Intelligence (Zero-Cloud)',
        description: 'Offline Devanagari & Latin cadastral intelligence with semantic evidence attribution.',
      },
      {
        type: 'deterministic-fallback',
        name: 'Deterministic Regex Engine (Fallback)',
        description: 'Direct cadastral rule parser for standard state Jamabandi & RoR formats.',
      },
      {
        type: 'api-connected',
        name: 'Connected Indic AI (Configurable API)',
        description: 'Optional cloud endpoint for deep multi-page and degraded document reasoning.',
      },
    ];
  }
}
