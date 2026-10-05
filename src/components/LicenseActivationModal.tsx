import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
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
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.api.getGoogleUser?.().then(setGoogleEmail).catch(() => undefined);
  }, [open ]);

  const signInWithGoogle = async () => {
    if (!window.api.googleSignIn) {
      toast.error('This build does not support Google sign-in yet.');
      return;
    }
    setSigningIn(true);
    try {
      const { email } = await window.api.googleSignIn();
      setGoogleEmail(email);
      toast.success(`Signed in as ${email} — this device is now linked to your account.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const signOutGoogle = async () => {
    try {
      await window.api.googleSignOut?.();
    } catch {
      /* ignore */
    }
    setGoogleEmail(null);
  };

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
                ? 'bg-brand-200 text-canvas shadow'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'key' ? (
        <div>
          {/* Step 1 — Google identity (device binding) */}
          <p className="block text-[11px] font-bold uppercase tracking-widest text-content-muted mb-2">
            Step 1 — Link your Google account
          </p>
          {googleEmail ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-status-emerald-bg border border-status-emerald-border mb-5">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-sm font-bold text-status-emerald-dark shrink-0">
                {googleEmail.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-content-primary truncate">{googleEmail}</p>
                <p className="text-[11px] text-content-muted">This device will be locked to this account</p>
              </div>
              <button
                onClick={signOutGoogle}
                className="shrink-0 p-2 rounded-lg text-content-muted hover:text-status-coral hover:bg-status-coral-bg transition cursor-pointer"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="w-full mb-5 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 transition flex items-center justify-center gap-3 text-sm font-semibold text-slate-800 cursor-pointer"
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {signingIn ? 'Opening Google…' : 'Sign in with Google'}
            </button>
          )}

          <label htmlFor="product-key" className="block text-[11px] font-bold uppercase tracking-widest text-content-muted mb-2">
            Step 2 — Product key from your reseller
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
              {googleEmail
                ? ' Because you signed in, it is also registered to your Google account — it cannot be activated on another device.'
                : ' Tip: sign in with Google above to register this device to your account, so the key can\u2019t be reused elsewhere.'}
              {' '}It keeps working with no internet connection.
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
