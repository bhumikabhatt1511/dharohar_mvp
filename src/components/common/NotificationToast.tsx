import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  useEffect(() => {
    const timers = notifications
      .map((n) => window.setTimeout(() => dismissNotification(n.id), n.type === 'error' ? 6000 : n.type === 'warning' ? 5500 : 4000));
    return () => timers.forEach(window.clearTimeout);
  }, [notifications, dismissNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.slice(0, 3).map((notif) => {
        let borderClass = 'border-blue-300 bg-white text-slate-900 shadow-lg';
        let icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;

        if (notif.type === 'success') {
          borderClass = 'border-emerald-300 bg-white text-slate-900 shadow-lg';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
        } else if (notif.type === 'warning') {
          borderClass = 'border-amber-300 bg-white text-slate-900 shadow-lg';
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
        } else if (notif.type === 'error') {
          borderClass = 'border-rose-300 bg-white text-slate-900 shadow-lg';
          icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
        }

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border ${borderClass} transition-all animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                <span className="text-[10px] text-slate-600 font-mono">{notif.timestamp}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(notif.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
