import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import logoImg from '../assets/ss_mart_logo.png';

interface PinLoginProps {
  onLoginSuccess: (user: { id: number; name: string; role: string }) => void;
}

export const PinLogin: React.FC<PinLoginProps> = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  // Set when the verified account still uses a seeded/default PIN.
  const [pendingRotation, setPendingRotation] = useState<{ id: number; name: string; role: string } | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pin]);

  const handleKey = (digit: string) => {
    setError('');
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const verifyPin = async (completedPin: string) => {
    try {
      const user = await window.api.verifyUserPin(completedPin);
      if (user) {
        if (user.mustChangePin) {
          // Seeded default PIN — force rotation before unlocking the POS.
          setPendingRotation({ id: user.id, name: user.name, role: user.role });
          setPin('');
        } else {
          onLoginSuccess(user);
        }
      } else {
        setError('Invalid Security PIN');
        setPin('');
      }
    } catch (err) {
      setError('System authentication error');
      setPin('');
    }
  };

  if (pendingRotation) {
    return (
      <PinRotationScreen
        userName={pendingRotation.name}
        onComplete={async (newPin) => {
          const ok = await window.api.changeUserPin(pendingRotation.id, newPin);
          if (ok) onLoginSuccess(pendingRotation);
          else throw new Error('Could not save the new PIN. Try again.');
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 backdrop-blur-2xl">
      {/* Liquid Glass Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-1/2 w-72 h-72 bg-status-emerald/15 rounded-full blur-3xl" />
      </div>

      <div className="liquid-glass-thick w-full max-w-md p-8 rounded-3xl text-center animate-in zoom-in-95 duration-300 relative z-10">
        {/* Animated SS Mart Brand Logo with specular bezel */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl overflow-hidden liquid-glass-clear p-1.5 shadow-[0_0_30px_rgba(255,255,255,0.2)] animate-pulse">
          <img src={logoImg} alt="SS Mart Logo" className="w-full h-full object-cover rounded-xl" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-wider mb-2">POS SYSTEM SECURED</h2>
        <p className="text-gray-400 text-sm mb-6">Please enter your 4-digit Cashier / Manager PIN</p>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                idx < pin.length
                  ? 'bg-cyan-400 border-cyan-400 scale-125 shadow-[0_0_10px_rgba(255, 255, 255, 0.8)]'
                  : 'bg-transparent border-white/20'
              }`}
            />
          ))}
        </div>

        {/* Error Alert */}
        <div className="h-10 mb-2">
          {error && (
            <div className="flex items-center justify-center gap-2 text-status-coral font-bold text-sm bg-status-coral/20 border border-status-coral/20 py-2 rounded-xl animate-in fade-in slide-in-from-top-2">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKey(num)}
              className="w-16 h-16 rounded-2xl liquid-press text-2xl font-extrabold text-white transition-all flex items-center justify-center mx-auto shadow-md active:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="w-16 h-16 rounded-2xl liquid-press text-sm font-black text-status-coral hover:text-status-coral transition-all flex items-center justify-center mx-auto"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKey('0')}
            className="w-16 h-16 rounded-2xl liquid-press text-2xl font-extrabold text-white transition-all flex items-center justify-center mx-auto shadow-md active:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-2xl liquid-press text-sm font-black text-status-amber hover:text-status-amber transition-all flex items-center justify-center mx-auto"
          >
            DEL
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Forced PIN rotation screen. Shown once when an account still uses a seeded
 * default PIN (1234/9999): the user picks a new 4-digit PIN and confirms it
 * before the POS unlocks. The default PIN can never be reused afterwards
 * because changeUserPin clears the must_change_pin flag.
 */
const PinRotationScreen: React.FC<{
  userName: string;
  onComplete: (newPin: string) => Promise<void>;
}> = ({ userName, onComplete }) => {
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleKey = (digit: string) => {
    setError('');
    if (saving || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const submit = async (completed: string) => {
    if (stage === 'enter') {
      setFirst(completed);
      setPin('');
      setStage('confirm');
      return;
    }
    if (completed !== first) {
      setError('PINs do not match — start over.');
      setFirst('');
      setPin('');
      setStage('enter');
      return;
    }
    setSaving(true);
    try {
      await onComplete(completed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the new PIN.');
      setFirst('');
      setPin('');
      setStage('enter');
      setSaving(false);
    }
  };

  const handleBackspace = () => {
    if (saving) return;
    setPin(pin.slice(0, -1));
    setError('');
  };
  const handleClear = () => {
    if (saving) return;
    setPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 backdrop-blur-2xl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-96 h-96 bg-status-amber/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="liquid-glass-thick w-full max-w-md p-8 rounded-3xl text-center relative z-10">
        <h2 className="text-2xl font-black text-white tracking-wider mb-2">SET A NEW PIN</h2>
        <p className="text-gray-400 text-sm mb-1">
          {userName}, your account is still using a default PIN.
        </p>
        <p className="text-status-amber text-xs font-semibold mb-6">
          {stage === 'enter' ? 'Choose a new 4-digit PIN.' : 'Enter the same PIN again to confirm.'}
        </p>

        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                idx < pin.length
                  ? 'bg-status-amber border-status-amber scale-125'
                  : 'bg-transparent border-white/20'
              }`}
            />
          ))}
        </div>

        <div className="h-10 mb-2">
          {error && (
            <div className="flex items-center justify-center gap-2 text-status-coral font-bold text-sm bg-status-coral/20 border border-status-coral/20 py-2 rounded-xl">
              <ShieldAlert size={16} /> <span>{error}</span>
            </div>
          )}
          {saving && <p className="text-content-secondary text-sm">Saving…</p>}
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKey(num)}
              disabled={saving}
              className="w-16 h-16 rounded-2xl liquid-press text-2xl font-extrabold text-white transition-all flex items-center justify-center mx-auto shadow-md disabled:opacity-40"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={saving}
            className="w-16 h-16 rounded-2xl liquid-press text-sm font-black text-status-coral transition-all flex items-center justify-center mx-auto disabled:opacity-40"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKey('0')}
            disabled={saving}
            className="w-16 h-16 rounded-2xl liquid-press text-2xl font-extrabold text-white transition-all flex items-center justify-center mx-auto shadow-md disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={saving}
            className="w-16 h-16 rounded-2xl liquid-press text-sm font-black text-status-amber transition-all flex items-center justify-center mx-auto disabled:opacity-40"
          >
            DEL
          </button>
        </div>
      </div>
    </div>
  );
};
