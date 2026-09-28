import React from 'react';
import { SAMPLE_DOCUMENTS } from '../../data/sampleDocuments';
import { normalizeDocumentList } from '../../utils/documentNormalizer';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('DHAROHAR UI error captured by boundary:', error, info);
    // Proactively attempt safe recovery of document state in local storage
    try {
      const saved = localStorage.getItem('dharohar.documents.v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const normalized = normalizeDocumentList(parsed);
          localStorage.setItem('dharohar.documents.v1', JSON.stringify(normalized));
        }
      }
    } catch {
      // Fallback
    }
  }

  handleRecoverWorkspace = () => {
    try {
      const saved = localStorage.getItem('dharohar.documents.v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const normalized = normalizeDocumentList(parsed);
          localStorage.setItem('dharohar.documents.v1', JSON.stringify(normalized));
        }
      } else {
        localStorage.setItem('dharohar.documents.v1', JSON.stringify(SAMPLE_DOCUMENTS));
      }
      sessionStorage.setItem('dharohar.activeView.v3', 'dashboard');
    } catch {
      localStorage.setItem('dharohar.documents.v1', JSON.stringify(SAMPLE_DOCUMENTS));
      sessionStorage.setItem('dharohar.activeView.v3', 'dashboard');
    }
    window.location.reload();
  };

  handleResetDocuments = () => {
    try {
      localStorage.setItem('dharohar.documents.v1', JSON.stringify(SAMPLE_DOCUMENTS));
      sessionStorage.setItem('dharohar.activeView.v3', 'dashboard');
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold text-lg">
              !
            </div>
            <div>
              <div className="text-sm font-bold text-rose-900">DHAROHAR encountered a UI error</div>
              <p className="text-xs text-slate-500 mt-0.5">Automated recovery engine is ready to restore your workspace.</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
            Your saved prototype records, parcels, and authentication remain preserved in this browser. Click <strong>Recover Workspace</strong> to sanitize saved records and resume at the Dashboard.
          </p>

          {this.state.errorMessage && (
            <div className="text-[11px] font-mono text-slate-500 bg-slate-100 p-2.5 rounded border border-slate-200 overflow-x-auto max-h-24">
              {this.state.errorMessage}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleRecoverWorkspace}
              className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center"
            >
              Recover Workspace
            </button>
            <button
              onClick={this.handleResetDocuments}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Seed Data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
