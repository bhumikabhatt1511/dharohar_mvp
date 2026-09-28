import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n';
import { DocumentViewer } from '../common/DocumentViewer';
import {
  FileCheck2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sliders,
  Sun,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const QualityCheckView: React.FC = () => {
  const { activeDocument, updateQualityEnhancements, setActiveView } = useApp();
  const { t, isHindi } = useTranslation();

  if (!activeDocument) {
    return (
      <div className="text-center py-12 text-slate-400">
        {t.quality.noDocSelected}
      </div>
    );
  }

  const [deskew, setDeskew] = useState<boolean>(activeDocument.qualityEnhancements.deskew);
  const [deskewAngle, setDeskewAngle] = useState<number>(activeDocument.qualityMetrics.skewAngle);
  const [binarize, setBinarize] = useState<boolean>(activeDocument.qualityEnhancements.binarize);
  const [denoise, setDenoise] = useState<boolean>(activeDocument.qualityEnhancements.denoise);
  const [contrastBoost, setContrastBoost] = useState<boolean>(activeDocument.qualityEnhancements.contrastBoost);
  const [sharpen, setSharpen] = useState<boolean>(activeDocument.qualityEnhancements.sharpen);

  const handleApplyEnhancements = () => {
    updateQualityEnhancements(activeDocument.id, {
      deskew,
      deskewAngle,
      binarize,
      denoise,
      contrastBoost,
      sharpen,
      contrast: contrastBoost ? 130 : 100,
    });
  };

  const handleAutoEnhanceAll = () => {
    setDeskew(true);
    setDeskewAngle(0);
    setBinarize(true);
    setDenoise(true);
    setContrastBoost(true);
    setSharpen(true);
    updateQualityEnhancements(activeDocument.id, {
      deskew: true,
      deskewAngle: 0,
      binarize: true,
      denoise: true,
      contrastBoost: true,
      sharpen: true,
      contrast: 135,
    });
  };

  const isHighQuality = activeDocument.qualityMetrics.overallScore >= 80;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-700 font-mono font-medium">
            <span>{t.nav.stepIndicator(3, 9)}</span>
            <span>•</span>
            <span>{t.quality.stepTag}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            {t.quality.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.common.documentLabel} <span className="font-mono text-slate-800 font-semibold">{activeDocument.fileName}</span> ({activeDocument.documentCode})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveView('upload')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>{t.common.back}</span>
          </button>

          <button
            onClick={handleAutoEnhanceAll}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>{t.quality.autoEnhanceAll}</span>
          </button>

          <button
            onClick={() => setActiveView('processing')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <span>{t.quality.proceedOcr}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Quality Metric Cards + Interactive Enhancements + Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 cols: Metric Tiles & Enhancement Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quality Assessment Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t.quality.metricsTitle}</h3>
                <p className="text-[11px] text-slate-500">{t.quality.metricsSub}</p>
              </div>

              <div className="text-right">
                <span
                  className={`text-xl font-extrabold font-mono ${
                    isHighQuality ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {activeDocument.qualityMetrics.overallScore}/100
                </span>
                <span className="text-[10px] block text-slate-500 font-mono font-medium">
                  {isHighQuality ? t.quality.gradeAReady : t.quality.gradeCEnhance}
                </span>
              </div>
            </div>

            {/* Metrics List */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] block">{t.quality.dpi}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-slate-800">
                    {activeDocument.qualityMetrics.dpi} DPI
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] block">{t.quality.skew}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-amber-700">
                    {activeDocument.qualityMetrics.skewAngle}°
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">{isHindi ? 'स्वतः-संशोधित' : 'Auto-corrected'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] block">{t.quality.sharpness}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-slate-800">
                    {activeDocument.qualityMetrics.blurScore}/100
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">{isHindi ? 'अनुकूल' : 'Optimal'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] block">{t.quality.contrast}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-slate-800">
                    {activeDocument.qualityMetrics.contrastRatio}:1
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">{isHindi ? 'सफल' : 'Passed'}</span>
                </div>
              </div>
            </div>

            {/* Stains and Lighting Notes */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.quality.lighting}</span>
                <span className="font-medium text-slate-800">
                  {activeDocument.qualityMetrics.lighting}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t.quality.stains}</span>
                <span className="font-medium text-slate-800">
                  {activeDocument.qualityMetrics.stainsAndFolds}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Pre-processing Filters Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-700" />
              <span>{t.quality.filtersTitle}</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              {/* Deskew Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <div className="font-semibold text-slate-800">{t.quality.deskew}</div>
                  <div className="text-[10px] text-slate-500">{isHindi ? 'दस्तावेज़ के झुकाव को सीधा करता है' : 'Corrects scanner feed misalignment'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeskew(!deskew);
                    handleApplyEnhancements();
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    deskew ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      deskew ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Binarization Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <div className="font-semibold text-slate-800">{t.quality.binarize}</div>
                  <div className="text-[10px] text-slate-500">{isHindi ? 'काले अक्षरों को पृष्ठभूमि से अलग करता है' : 'Isolates dark ink from aged paper background'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBinarize(!binarize);
                    handleApplyEnhancements();
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    binarize ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      binarize ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Denoise & Despeckle */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <div className="font-semibold text-slate-800">{isHindi ? 'दाग व धब्बे हटाना (Denoise)' : 'Despeckle & Denoise'}</div>
                  <div className="text-[10px] text-slate-500">{isHindi ? 'कागज़ के दाने और स्याही के धब्बे हटाता है' : 'Removes paper grain & ink bleeds'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDenoise(!denoise);
                    handleApplyEnhancements();
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    denoise ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      denoise ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Contrast Booster */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <div className="font-semibold text-slate-800">{t.quality.contrastBoost}</div>
                  <div className="text-[10px] text-slate-500">{isHindi ? 'देवनागरी लिखावट की स्पष्टता बढ़ाता है' : 'Increases Devanagari stroke definition'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContrastBoost(!contrastBoost);
                    handleApplyEnhancements();
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    contrastBoost ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      contrastBoost ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 cols: Document Visual Stage */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{isHindi ? 'इंटरैक्टिव दस्तावेज़ निरीक्षण' : 'Interactive Document Inspection Viewport'}</span>
            <span>{isHindi ? 'गुणवत्ता जांचने के लिए ज़ूम और फ़िल्टर का उपयोग करें' : 'Use zoom & filters below to inspect resolution'}</span>
          </div>

          <DocumentViewer
            document={activeDocument}
            showBoundingBoxes={false}
            allowEnhancementControls={true}
            heightClass="h-[620px]"
          />
        </div>
      </div>
    </div>
  );
};
