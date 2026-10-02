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
    <div className="px-4 py-2.5 border-b border-canvas-card bg-canvas-subtle/60 flex items-center gap-2">
      <button 
        onClick={onHold}
        disabled={cartIsEmpty || isOrderHeld}
        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-status-amber bg-status-amber/10 hover:bg-status-amber/15 border border-status-amber/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Hold current order (F2)"
      >
        <Pause size={13} /> 
        <span>Hold</span>
        <span className="text-[10px] text-status-amber/60 font-mono">F2</span>
      </button>
      <button 
        onClick={onResume}
        disabled={!isOrderHeld || !cartIsEmpty}
        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-status-emerald bg-status-emerald/10 hover:bg-status-emerald/15 border border-status-emerald/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Resume held order (F2)"
      >
        <Play size={13} /> 
        <span>Resume</span>
        {isOrderHeld && <span className="w-1.5 h-1.5 rounded-full bg-status-emerald animate-pulse"></span>}
      </button>
      <button 
        onClick={onClear}
        disabled={cartIsEmpty}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 text-status-coral bg-status-coral/10 hover:bg-status-coral/15 border border-status-coral/30 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Void current cart"
      >
        <Ban size={14} />
        <span className="text-[11px]">Void</span>
      </button>
    </div>
  );
};
