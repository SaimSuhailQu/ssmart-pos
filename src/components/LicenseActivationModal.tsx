import React, { useState } from 'react';
import { KeyRound, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { LicenseState } from '../types';
import { toast } from '../state/toast';

interface LicenseActivationModalProps {
  open: boolean;
  onClose: () => void;
  deviceCode: string;
  fingerprint: string;
  /** Called with the fresh state after a successful activation. */
  onActivated: (state: LicenseState) => void;
}

/**
 * "Enter Product Key / Activate Online" recovery modal.
 *
 * Two paths:
 *  1. Product Key — paste the Ed25519 key from the reseller; verified
 *     fully offline, bound to this device, cached encrypted.
 *  2. Device Code — the existing WhatsApp flow: copy the code, send it to
 *     sales, then hit "Recheck Activation".
 */
export const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({
  open,
  onClose,
  deviceCode,
  fingerprint,
  onActivated,
}) => {
  const [tab, setTab] = useState<'key' | 'code'>('key');
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activate = async () => {
    const key = keyInput.trim();
    if (key.length < 16) {
      toast.warning('Paste the complete product key first.');
      return;
    }
    if (!window.api.activateProductKey) {
      toast.error('This build does not support product-key activation yet.');
      return;
    }
    setActivating(true);
    try {
      const state = await window.api.activateProductKey(key);
      toast.success(
        `Activated — ${state.mode === 'licensed' ? 'license valid' : 'check status'}${
          state.expiresAt ? ` until ${new Date(state.expiresAt).toLocaleDateString()}` : ''
        }.`,
      );
      onActivated(state);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Activation failed.');
    } finally {
      setActivating(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(deviceCode || fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the code manually.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Activate SSmart POS" subtitle="Choose how to license this terminal" size="md">
      <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-canvas border border-canvas-border">
        {(
          [
            { id: 'key', label: 'Product Key' },
            { id: 'code', label: 'Device Code' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              tab === t.id
                ? 'bg-brand-600 text-white shadow'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'key' ? (
        <div>
          <label htmlFor="product-key" className="block text-[11px] font-bold uppercase tracking-widest text-content-muted mb-2">
            Product key from your reseller
          </label>
          <textarea
            id="product-key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
            placeholder="SSM1-XXXX-XXXX-…"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl bg-canvas border border-canvas-border text-content-primary font-mono text-sm tracking-wide placeholder:text-content-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
          <div className="flex items-start gap-2 mt-3 text-[11px] text-content-muted leading-relaxed">
            <AlertCircle size={13} className="shrink-0 mt-0.5 text-status-amber" />
            <span>
              The key is verified offline with cryptography and locked to this machine.
              It keeps working with no internet connection.
            </span>
          </div>
          <Button variant="primary" size="touch" className="w-full mt-5" onClick={activate} loading={activating}>
            <KeyRound size={16} /> Activate License
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-content-muted mb-2">
            Your device code
          </p>
          <div className="flex items-center gap-2 p-4 rounded-xl bg-canvas border border-canvas-border">
            <code className="flex-1 font-mono text-lg font-bold text-brand-300 tracking-widest text-center">
              {deviceCode || '…'}
            </code>
            <button
              onClick={copyCode}
              className="shrink-0 px-3 py-2 rounded-lg bg-brand-600/20 border border-brand-500/40 text-brand-200 hover:bg-brand-600/30 transition flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
            >
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-content-secondary leading-relaxed mt-4">
            Send this code to <span className="font-semibold text-content-primary">SS Mart POS Sales</span> on
            WhatsApp. Once they activate it, press <span className="font-semibold">Recheck</span> below —
            no reinstall needed.
          </p>
          <Button variant="secondary" size="lg" className="w-full mt-4" onClick={onClose}>
            Recheck Activation
          </Button>
        </div>
      )}
    </Modal>
  );
};
