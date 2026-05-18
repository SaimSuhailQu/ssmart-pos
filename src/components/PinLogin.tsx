import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import logoImg from '../assets/ss_mart_logo.png';

interface PinLoginProps {
  onLoginSuccess: (user: { id: number; name: string; role: string }) => void;
}

export const PinLogin: React.FC<PinLoginProps> = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

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
        onLoginSuccess(user);
      } else {
        setError('Invalid Security PIN');
        setPin('');
      }
    } catch (err) {
      setError('System authentication error');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-2xl">
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.15)] text-center animate-in zoom-in-95 duration-300">
        
        {/* Animated SS Mart Brand Logo */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(0,240,255,0.2)] animate-pulse">
          <img src={logoImg} alt="SS Mart Logo" className="w-full h-full object-cover" />
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
                  ? 'bg-cyan-400 border-cyan-400 scale-125 shadow-[0_0_10px_rgba(0,240,255,0.8)]'
                  : 'bg-transparent border-white/20'
              }`}
            />
          ))}
        </div>

        {/* Error Alert */}
        <div className="h-10 mb-2">
          {error && (
            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm bg-red-950/20 border border-red-500/20 py-2 rounded-xl animate-in fade-in slide-in-from-top-2">
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
              className="w-16 h-16 rounded-2xl glass-button text-2xl font-extrabold text-white hover:text-cyan-300 transition-all flex items-center justify-center mx-auto"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="w-16 h-16 rounded-2xl glass-button text-sm font-black text-red-400 hover:text-red-300 transition-all flex items-center justify-center mx-auto"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKey('0')}
            className="w-16 h-16 rounded-2xl glass-button text-2xl font-extrabold text-white hover:text-cyan-300 transition-all flex items-center justify-center mx-auto"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-2xl glass-button text-sm font-black text-orange-400 hover:text-orange-300 transition-all flex items-center justify-center mx-auto"
          >
            DEL
          </button>
        </div>
      </div>
    </div>
  );
};
