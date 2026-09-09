import React from 'react';
import { Pause, Play, Ban } from 'lucide-react';

interface OrderControlsProps {
  onHold: () => void;
  onResume: () => void;
  onClear: () => void;
  isOrderHeld: boolean;
  cartIsEmpty: boolean;
}

export const OrderControls: React.FC<OrderControlsProps> = ({ 
  onHold, onResume, onClear, isOrderHeld, cartIsEmpty 
}) => {
  return (
    <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
      <button 
        onClick={onHold}
        disabled={cartIsEmpty || isOrderHeld}
        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Hold current order (F2)"
      >
        <Pause size={13} /> 
        <span>Hold</span>
        <span className="text-[10px] text-amber-400/60 font-mono">F2</span>
      </button>
      <button 
        onClick={onResume}
        disabled={!isOrderHeld || !cartIsEmpty}
        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Resume held order (F2)"
      >
        <Play size={13} /> 
        <span>Resume</span>
        {isOrderHeld && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
      </button>
      <button 
        onClick={onClear}
        disabled={cartIsEmpty}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Void current cart"
      >
        <Ban size={14} />
        <span className="text-[11px]">Void</span>
      </button>
    </div>
  );
};
