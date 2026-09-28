import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n';
import { DISTRICT_METRICS } from '../../data/mockData';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Filter,
  Layers,
} from 'lucide-react';

export const DigitizationReportsView: React.FC = () => {
  const { addNotification } = useApp();
  const { t, isHindi } = useTranslation();
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('FY 2024-25');

  const handleExportMISReport = (format: 'CSV' | 'PDF') => {
    addNotification(
      isHindi ? 'निर्यात प्रारंभ' : 'Export Initiated',
      isHindi ? `राज्य राजस्व MIS रिपोर्ट (${format}) सफलतापूर्वक सृजित हुई।` : `State Revenue MIS Report (${format}) generated successfully.`,
      'success'
    );
  };

  const totalDigitizedHa = DISTRICT_METRICS.reduce((acc, d) => acc + d.digitizedAreaHectares, 0);
  const totalVerifiedRecords = DISTRICT_METRICS.reduce((acc, d) => acc + d.verifiedRecords, 0);
  const totalRecords = DISTRICT_METRICS.reduce((acc, d) => acc + d.totalRecords, 0);
  const stateAveragePct = ((totalVerifiedRecords / totalRecords) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-700 font-mono font-medium">
            <span>{t.reports.stepBadge}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <span>{t.reports.title}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.reports.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExportMISReport('CSV')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.reports.exportCsv}</span>
          </button>

          <button
            onClick={() => handleExportMISReport('PDF')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t.reports.exportPdf}</span>
          </button>
        </div>
      </div>

      {/* State Aggregates Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs block">{t.reports.overallState}</span>
          <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">{stateAveragePct}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totalVerifiedRecords.toLocaleString()} / {totalRecords.toLocaleString()} {isHindi ? 'अभिलेख' : 'Records'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs block">{t.reports.totalAreaSealed}</span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
            {totalDigitizedHa.toLocaleString()} {isHindi ? 'हैक्टर' : 'Ha'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isHindi ? `लगभग ${(totalDigitizedHa * 3.95).toFixed(0)} बीघा` : `Approx. ${(totalDigitizedHa * 3.95).toFixed(0)} Bigha`}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs block">{t.reports.ocrCer}</span>
          <div className="text-2xl font-bold text-blue-700 font-mono mt-1">0.82%</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">{t.reports.ocrPrecision}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-slate-500 text-xs block">{t.reports.slaResolution}</span>
          <div className="text-2xl font-bold text-slate-800 font-mono mt-1">1.8 {isHindi ? 'दिन' : 'Days'}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{t.reports.slaMandate}</div>
        </div>
      </div>

      {/* District Progress Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t.reports.districtProgressTitle}</h3>
            <p className="text-[11px] text-slate-500">{t.reports.districtProgressSubtitle}</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{selectedTimeframe}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-mono uppercase">
              <tr>
                <th className="p-3.5">{t.reports.colDistrict}</th>
                <th className="p-3.5">{t.reports.colTotal}</th>
                <th className="p-3.5">{t.reports.colDigitized}</th>
                <th className="p-3.5">{t.reports.colPending}</th>
                <th className="p-3.5">{t.reports.colArea}</th>
                <th className="p-3.5">{t.reports.colOcrAcc}</th>
                <th className="p-3.5">{t.reports.colCompletion}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {DISTRICT_METRICS.map((dist) => (
                <tr key={dist.district} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900 text-xs">{dist.district}</td>
                  <td className="p-3.5 font-mono text-slate-700">{dist.totalRecords.toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-emerald-700 font-bold">
                    {dist.verifiedRecords.toLocaleString()}
                  </td>
                  <td className="p-3.5 font-mono text-amber-700 font-semibold">{dist.pendingReview.toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-slate-700">{dist.digitizedAreaHectares.toLocaleString()} {isHindi ? 'हैक्टर' : 'Ha'}</td>
                  <td className="p-3.5 font-mono text-blue-700 font-bold">{dist.ocrAccuracyRate}%</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${dist.completionPercentage}%` }}
                          className={`h-full ${
                            dist.completionPercentage >= 85 ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}
                        />
                      </div>
                      <span className="font-mono text-slate-800 font-bold text-[11px]">
                        {dist.completionPercentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discrepancy & Operator Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discrepancy Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>{t.reports.discrepancyTitle}</span>
            <span className="text-xs font-mono text-slate-500">{t.reports.totalFlags}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>{t.reports.disc1}</span>
                <span className="font-mono text-slate-900 font-bold">42% ({isHindi ? '७७४ अभिलेख' : '774 records'})</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-[42%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>{t.reports.disc2}</span>
                <span className="font-mono text-slate-900 font-bold">28% ({isHindi ? '५१६ अभिलेख' : '516 records'})</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full w-[28%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>{t.reports.disc3}</span>
                <span className="font-mono text-slate-900 font-bold">18% ({isHindi ? '३३१ अभिलेख' : '331 records'})</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[18%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 mb-1">
                <span>{t.reports.disc4}</span>
                <span className="font-mono text-slate-900 font-bold">12% ({isHindi ? '२२१ अभिलेख' : '221 records'})</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-slate-500 h-full w-[12%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Officer Throughput Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>{t.reports.officerProductivity}</span>
            <span className="text-xs font-mono text-emerald-700">{t.reports.activeSla}</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{isHindi ? 'राजेश कुमार मीणा' : 'Rajesh Kumar Meena'}</div>
                <div className="text-[10px] text-slate-500">{isHindi ? 'तहसीलदार • सांगानेर (जयपुर)' : 'Tehsildar • Sanganer (Jaipur)'}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-700">{isHindi ? '१,२४० सत्यापित' : '1,240 Verified'}</div>
                <div className="text-[10px] text-slate-400">{isHindi ? 'औसत ४.८ मिनट/अभिलेख' : 'Avg 4.8 min/doc'}</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{isHindi ? 'अनीता शर्मा' : 'Anita Sharma'}</div>
                <div className="text-[10px] text-slate-500">{isHindi ? 'राजस्व अधिकारी • मंडोर (जोधपुर)' : 'Revenue Officer • Mandore (Jodhpur)'}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-700">{isHindi ? '१,०८५ सत्यापित' : '1,085 Verified'}</div>
                <div className="text-[10px] text-slate-400">{isHindi ? 'औसत ५.२ मिनट/अभिलेख' : 'Avg 5.2 min/doc'}</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{isHindi ? 'विक्रम राठौड़' : 'Vikram Rathore'}</div>
                <div className="text-[10px] text-slate-500">{isHindi ? 'नायब तहसीलदार • गिर्वा (उदयपुर)' : 'Naib Tehsildar • Girwa (Udaipur)'}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-700">{isHindi ? '९४० सत्यापित' : '940 Verified'}</div>
                <div className="text-[10px] text-slate-400">{isHindi ? 'औसत ६.१ मिनट/अभिलेख' : 'Avg 6.1 min/doc'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
