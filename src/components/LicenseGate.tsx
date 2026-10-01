import React, { useEffect, useState, useCallback } from 'react';
import { LicenseState } from '../types';
import { ShieldAlert, ShieldX, Copy, RefreshCw } from 'lucide-react';

interface LicenseGateProps {
  children: React.ReactNode;
}

/**
 * Device-locked licensing gate for the desktop POS.
 *
 *  - licensed: renders the app normally (with a subtle "Licensed" state).
 *  - trial: renders the app with a slim days-remaining banner.
 *  - expired/revoked: blocks the app and shows the device fingerprint for
 *    remote activation by the reseller (this device's fingerprint becomes
 *    the license key in the reseller's Firebase licensing database).
 */
export const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
  const [license, setLicense] = useState<LicenseState | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      if (window.api.getDeviceFingerprint) {
        const fp = await window.api.getDeviceFingerprint();
        setFingerprint(fp);
      }
      if (window.api.getLicenseState) {
        const state = await window.api.getLicenseState();
        setLicense(state);
      }
    } catch {
      /* bridge not ready yet; the revoked listener will re-trigger */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, lastRefresh]);

  // Main process pushes revocation (remote deactivation / expiry)
  useEffect(() => {
    if (!window.api.onLicenseRevoked) return;
    const unsub = window.api.onLicenseRevoked(() => {
      setLastRefresh(Date.now());
      refresh();
    });
    return () => {
      unsub?.();
    };
  }, [refresh]);

  const copyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Loading state while the first license check completes
  if (!license) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Verifying license…</p>
        </div>
      </div>
    );
  }

  const fingerprintShort = fingerprint
    ? `${fingerprint.slice(0, 16)}…${fingerprint.slice(-8)}`
    : license.fingerprint
      ? `${license.fingerprint.slice(0, 16)}…${license.fingerprint.slice(-8)}`
      : '—';

  const fullFingerprint = fingerprint || license.fingerprint;

  // Blocked: trial over, license revoked, or subscription expired
  if (license.status === 'expired') {
    const reason = license.error === 'license_revoked'
      ? 'This license has been deactivated by the vendor.'
      : license.error === 'subscription_expired'
        ? 'The subscription period for this license has ended.'
        : 'Your free trial period has ended.';

    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans">
        <div className="w-full max-w-lg bg-slate-900 border border-rose-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
            <ShieldX size={30} className="text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Activation Required</h1>
          <p className="text-slate-400 text-sm mb-6">{reason}</p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-5 text-left">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">
              Your Device Code (send this to activate)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-indigo-300 break-all leading-relaxed">
                {fullFingerprint || 'Computing device code…'}
              </code>
              <button
                onClick={copyFingerprint}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30 transition flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
                title="Copy device code"
              >
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            Contact <span className="text-slate-200 font-semibold">SS Mart POS Sales</span> with the device
            code above. Activation is locked to this machine only and cannot be transferred.
          </p>

          <button
            onClick={() => setLastRefresh(Date.now())}
            className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={13} /> Recheck Activation
          </button>
        </div>
      </div>
    );
  }

  // Trial banner floats above the app UI without affecting h-screen layout
  const trialBanner =
    license.status === 'trial' ? (
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[11px] font-semibold shadow-xl whitespace-nowrap">
        <ShieldAlert size={12} className="shrink-0" />
        <span>
          Free Trial — {license.daysRemaining ?? 0} day{(license.daysRemaining ?? 0) === 1 ? '' : 's'} remaining.
          {(license.daysRemaining ?? 0) <= 3 && ' Contact SS Mart POS Sales to activate.'}
        </span>
        <span className="hidden lg:inline text-amber-500/60 font-mono">({fingerprintShort})</span>
      </div>
    ) : null;

  // Wrap the app; intercept the revoked push to re-evaluate
  return (
    <LicenseRevokedBoundary>
      {children}
      {trialBanner}
    </LicenseRevokedBoundary>
  );
};

/**
 * Renders the blocked screen when the main process pushes a revocation while
 * the app is already running. Implemented as a boundary so the rest of the
 * LicenseGate can stay simple.
 */
const LicenseRevokedBoundary: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!window.api.onLicenseRevoked) return;
    const unsub = window.api.onLicenseRevoked(() => setRevoked(true));
    return () => {
      unsub?.();
    };
  }, []);

  if (revoked) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <ShieldX size={36} className="text-rose-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-white mb-2">License Deactivated</h1>
          <p className="text-slate-400 text-sm">
            This device&apos;s license was deactivated remotely. Please contact SS Mart POS Sales.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};
