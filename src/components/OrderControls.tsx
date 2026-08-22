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
    <div className="px-5 py-3 border-b border-white/5 bg-black/20 flex gap-2 backdrop-blur-sm">
      <button 
        onClick={onHold}
        disabled={cartIsEmpty || isOrderHeld}
        className="flex-1 glass-button py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-yellow-400 disabled:opacity-30 disabled:hover:bg-white/5"
      >
        <Pause size={16} /> Hold
      </button>
      <button 
        onClick={onResume}
        disabled={!isOrderHeld || !cartIsEmpty}
        className="flex-1 glass-button py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 text-neutral-200 disabled:opacity-30 disabled:hover:bg-white/5"
      >
        <Play size={16} /> Resume
      </button>
      <button 
        onClick={onClear}
        disabled={cartIsEmpty}
        className="px-4 glass-button py-2 rounded-xl text-sm font-bold flex items-center justify-center text-red-400 disabled:opacity-30 disabled:hover:bg-white/5"
        title="Void Order"
      >
        <Ban size={16} />
      </button>
    </div>
  );
};
