import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import {
  CadastralReconciliationEngine,
  LLMExtractionResult,
  FieldComparisonItem,
  ProviderType,
  LLMProviderFactory,
} from '../../services/llm';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Check,
  Edit2,
  Layers,
  FileCheck,
} from 'lucide-react';

interface LLMReconciliationPanelProps {
  rawOcrText: string;
  documentId: string;
  documentMetadata?: {
    fileName?: string;
    recordType?: string;
    district?: string;
    tehsil?: string;
    village?: string;
  };
  onApplyFieldValue: (field: string, value: any, source: string) => void;
}

export const LLMReconciliationPanel: React.FC<LLMReconciliationPanelProps> = ({
  rawOcrText,
  documentId,
  documentMetadata,
  onApplyFieldValue,
}) => {
  const { isHindi } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('local-dev');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [reconciliationResult, setReconciliationResult] = useState<LLMExtractionResult | null>(null);
  const [activeEditingField, setActiveEditingField] = useState<string | null>(null);
  const [editingCustomValue, setEditingCustomValue] = useState<string>('');
  const [appliedFields, setAppliedFields] = useState<Record<string, { value: any; source: string }>>({});

  const availableProviders = LLMProviderFactory.getAvailableProviders();

  // Run reconciliation on mount or when provider changes
  useEffect(() => {
    let isMounted = true;
    const executeReconciliation = async () => {
      setIsRunning(true);
      try {
        const result = await CadastralReconciliationEngine.reconcileExtraction(
          rawOcrText,
          documentMetadata,
          selectedProvider
        );
        if (isMounted) {
          setReconciliationResult(result);
        }
      } catch (err) {
        console.error('[DHAROHAR LLM] Reconciliation failed:', err);
      } finally {
        if (isMounted) {
          setIsRunning(false);
        }
      }
    };

    executeReconciliation();

    return () => {
      isMounted = false;
    };
  }, [rawOcrText, selectedProvider, documentId]);

  const handleAcceptOcr = (item: FieldComparisonItem) => {
    const val = item.deterministicValue;
    onApplyFieldValue(item.field, val, 'OCR/Deterministic Parser');
    setAppliedFields((prev) => ({
      ...prev,
      [item.field]: { value: val, source: 'deterministic' },
    }));
  };

  const handleAcceptLlm = (item: FieldComparisonItem) => {
    const val = item.llmValue;
    onApplyFieldValue(item.field, val, 'LLM Structured Intelligence');
    setAppliedFields((prev) => ({
      ...prev,
      [item.field]: { value: val, source: 'llm' },
    }));
  };

  const handleSaveManualEdit = (item: FieldComparisonItem) => {
    if (editingCustomValue.trim()) {
      onApplyFieldValue(item.field, editingCustomValue.trim(), 'Human Manual Override');
      setAppliedFields((prev) => ({
        ...prev,
        [item.field]: { value: editingCustomValue.trim(), source: 'manual' },
      }));
    }
    setActiveEditingField(null);
    setEditingCustomValue('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCH':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{isHindi ? 'समान (MATCH)' : 'MATCH'}</span>
          </span>
        );
      case 'CONFLICT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>{isHindi ? 'विसंगति (CONFLICT)' : 'CONFLICT'}</span>
          </span>
        );
      case 'MISSING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            <span>{isHindi ? 'अनुपलब्ध (MISSING)' : 'MISSING'}</span>
          </span>
        );
      case 'NEEDS_REVIEW':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-300">
            <FileCheck className="w-3 h-3 text-blue-600" />
            <span>{isHindi ? 'समीक्षा आवश्यक' : 'NEEDS REVIEW'}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white cursor-pointer select-none hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-blue-600/30 text-blue-300 border border-blue-400/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide">
                {isHindi ? 'एआई-सहायित भू-अभिलेख निष्कर्षण एवं मिलान' : 'LLM-Assisted Extraction & Dual-Engine Reconciliation'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {isHindi
                ? 'ओसीआर बनाम एलएलएम निष्कर्षण की तुलना • विसंगतियों का स्वतः पता लगाना • अधिकारी का निर्णय अंतिम'
                : 'Deterministic OCR vs LLM Structured Extraction cross-check • Human decision is final'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {reconciliationResult && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                {reconciliationResult.matchCount} Matches
              </span>
              {reconciliationResult.conflictsCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                  {reconciliationResult.conflictsCount} Conflicts
                </span>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 space-y-4 bg-slate-50/60">
          {/* Engine Controls & Provider Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="font-semibold text-slate-700">
                {isHindi ? 'बुद्धिमान निष्कर्षण प्रदाता:' : 'Intelligence Provider:'}
              </span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as ProviderType)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-medium text-xs focus:ring-1 focus:ring-blue-500"
              >
                {availableProviders.map((p) => (
                  <option key={p.type} value={p.type}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-blue-700">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isHindi ? 'तुलना की जा रही है...' : 'Reconciling...'}</span>
                </span>
              )}
              <span className="text-[11px] text-slate-500 font-mono">
                Engine Time: {reconciliationResult?.executionTimeMs ?? 0}ms
              </span>
            </div>
          </div>

          {/* Conflict Alert Banner if any */}
          {reconciliationResult && reconciliationResult.conflictsCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  {isHindi
                    ? `${reconciliationResult.conflictsCount} फ़ील्ड में विसंगति पाई गई`
                    : `${reconciliationResult.conflictsCount} Discrepancy(ies) Flagged for Officer Review`}
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {isHindi
                    ? 'ओसीआर पार्सर और एलएलएम मॉडल के मान भिन्न हैं। कृपया नीचे दिए गए विकल्पों में से सही मान का चयन करें अथवा मैन्युअल संपादन करें।'
                    : 'Values extracted by the Deterministic Parser and the LLM Assistant differ. Please accept the correct value or enter a manual override.'}
                </p>
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-3 font-semibold">{isHindi ? 'राजस्व फ़ील्ड' : 'Cadastral Field'}</th>
                  <th className="p-3 font-semibold">{isHindi ? 'ओसीआर / पार्सर मान' : 'OCR / Deterministic Value'}</th>
                  <th className="p-3 font-semibold">{isHindi ? 'एलएलएम सहायक मान' : 'LLM Assistant Value'}</th>
                  <th className="p-3 font-semibold">{isHindi ? 'ओसीआर साक्ष्य' : 'Document Evidence'}</th>
                  <th className="p-3 font-semibold text-center">{isHindi ? 'स्थिति' : 'Status'}</th>
                  <th className="p-3 font-semibold text-right">{isHindi ? 'सत्यापन निर्णय' : 'Verification Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliationResult?.comparisons.map((item) => {
                  const isCurrentEditing = activeEditingField === item.field;
                  const applied = appliedFields[item.field];

                  return (
                    <tr
                      key={item.field}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.status === 'CONFLICT' ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Field Name */}
                      <td className="p-3 font-medium text-slate-900">
                        <div>{item.label}</div>
                        <div className="text-[11px] text-slate-500 font-serif">{item.hindiLabel}</div>
                      </td>

                      {/* Deterministic Value */}
                      <td className="p-3 font-mono font-semibold text-slate-800">
                        {item.deterministicValue !== null && item.deterministicValue !== undefined ? (
                          <span>{String(item.deterministicValue)}</span>
                        ) : (
                          <span className="text-slate-400 italic">null</span>
                        )}
                      </td>

                      {/* LLM Value */}
                      <td className="p-3 font-mono font-semibold text-blue-900">
                        {item.llmValue !== null && item.llmValue !== undefined ? (
                          <span>{String(item.llmValue)}</span>
                        ) : (
                          <span className="text-slate-400 italic">null</span>
                        )}
                      </td>

                      {/* Evidence */}
                      <td className="p-3 text-[11px] text-slate-600 max-w-xs truncate font-serif" title={item.evidence || ''}>
                        {item.evidence ? (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.evidence}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Action */}
                      <td className="p-3 text-right">
                        {isCurrentEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="text"
                              value={editingCustomValue}
                              onChange={(e) => setEditingCustomValue(e.target.value)}
                              placeholder="Enter value"
                              className="border border-slate-300 rounded px-2 py-1 text-xs w-32 font-mono text-slate-900"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveManualEdit(item)}
                              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveEditingField(null)}
                              className="text-[11px] text-slate-500 hover:text-slate-700 px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {applied ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Accepted ({applied.source})</span>
                              </span>
                            ) : (
                              <>
                                {item.status === 'CONFLICT' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptOcr(item)}
                                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-300 transition-colors cursor-pointer"
                                      title="Accept Deterministic OCR value"
                                    >
                                      Accept OCR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptLlm(item)}
                                      className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-semibold border border-blue-300 transition-colors cursor-pointer"
                                      title="Accept LLM Model value"
                                    >
                                      Accept LLM
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptOcr(item)}
                                    className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveEditingField(item.field);
                                    setEditingCustomValue(
                                      String(item.deterministicValue ?? item.llmValue ?? '')
                                    );
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Edit Manually"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legal Authority Disclaimer */}
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
            <span>
              {isHindi
                ? 'वैधानिक सूचना: एलएलएम केवल निष्कर्षण एवं विसंगति सहायता प्रदान करता है। अंतिम विधिक स्वीकृति एवं डिजिटल मुहर राजस्व अधिकारी की संप्रभु जिम्मेदारी है।'
                : 'Statutory Disclaimer: The LLM serves purely as an extraction and reconciliation assistant. Final legal validity and digital sealing remain server-authoritative and require officer confirmation.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
