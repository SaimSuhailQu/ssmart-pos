import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { zIndex, motion } from '../../design/tokens';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** sm | md | lg — lg for dense desktop workflows. */
  size?: 'sm' | 'md' | 'lg';
  /** Close on backdrop click. Default true; false for tender flows. */
  dismissable?: boolean;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Accessible modal: portal, Esc to close, backdrop dismiss (optional),
 * initial focus on the dialog. Replaces the ~10 hand-rolled modals'
 * duplicated overlay markup.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissable = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the dialog for keyboard users.
    dialogRef.current?.focus();
    // Lock background scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ zIndex: zIndex.modal, animation: `fadeIn ${motion.ui}ms ${motion.easeOut}` }}
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`w-full ${sizes[size]} max-h-[90vh] flex flex-col bg-canvas-subtle border border-canvas-border rounded-2xl shadow-2xl outline-none`}
        style={{ animation: `popIn ${motion.ui}ms ${motion.easeOut}` }}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div>
            <h2 className="text-content-primary font-bold text-lg leading-tight">{title}</h2>
            {subtitle ? <p className="text-content-muted text-xs mt-1">{subtitle}</p> : null}
          </div>
          {dismissable ? (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg text-content-muted hover:text-content-primary hover:bg-canvas-hover transition cursor-pointer"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        <div className="px-6 py-5 overflow-y-auto grow">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body,
  );
};
