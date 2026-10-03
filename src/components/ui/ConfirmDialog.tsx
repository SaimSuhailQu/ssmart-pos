import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}

/**
 * Design-system replacement for `window.confirm` / `window.alert`.
 * 14 call sites across the managers should migrate to this — it keeps
 * focus management, Esc handling, and styling consistent, and it doesn't
 * block the renderer thread the way native dialogs do.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex items-start gap-3">
      {tone === 'danger' ? (
        <div className="w-10 h-10 shrink-0 rounded-xl bg-status-coral/10 border border-status-coral/25 flex items-center justify-center">
          <AlertTriangle size={18} className="text-status-coral" />
        </div>
      ) : null}
      <p className="text-sm text-content-secondary leading-relaxed pt-1.5">{message}</p>
    </div>
  </Modal>
);
