import React from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useStore } from '../../state/store';
import { toastStore, dismiss, ToastKind } from '../../state/toast';
import { zIndex, motion } from '../../design/tokens';

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-status-emerald shrink-0" />,
  error: <XCircle size={16} className="text-status-coral shrink-0" />,
  warning: <AlertTriangle size={16} className="text-status-amber shrink-0" />,
  info: <Info size={16} className="text-brand-400 shrink-0" />,
};

const borders: Record<ToastKind, string> = {
  success: 'border-status-emerald/30',
  error: 'border-status-coral/30',
  warning: 'border-status-amber/30',
  info: 'border-brand-500/30',
};

/**
 * ToastHost — mount once at the app root (inside LicenseGate).
 * Reads from `toastStore`; any module can push via `toast.*`.
 */
export const ToastHost: React.FC = () => {
  const toasts = useStore(toastStore, (s) => s.toasts);

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 flex flex-col gap-2 w-[min(92vw,380px)]"
      style={{ zIndex: zIndex.toast }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-xl bg-canvas-elevated border ${borders[t.kind]} shadow-2xl backdrop-blur-md`}
          style={{ animation: `slideIn ${motion.ui}ms ${motion.easeOut}` }}
        >
          {icons[t.kind]}
          <p className="flex-1 text-[13px] font-medium text-content-primary leading-snug">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-content-faint hover:text-content-primary transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
};
