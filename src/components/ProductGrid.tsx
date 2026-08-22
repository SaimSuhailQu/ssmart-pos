import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { Layers, Coffee, Cookie, Apple, Sparkles, Package, HeartPulse } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'all': return Layers;
    case 'drinks': return Coffee;
    case 'snacks': return Cookie;
    case 'groceries': return Apple;
    case 'personal care': return HeartPulse;
    case 'electronics': return Sparkles;
    default: return Package;
  }
};

const ProductCard = React.memo<{
  product: Product;
  onAddToCart: (product: Product) => void;
}>(({ product: p, onAddToCart }) => {
  return (
    <div 
      onClick={() => onAddToCart(p)}
      className="glass-panel p-5 cursor-pointer hover:bg-white/10 hover:border-white/40 transition-colors duration-100 group flex flex-col active:scale-[0.98] rounded-2xl relative"
    >
      <div className="flex-1 relative z-10">
        <div className="flex justify-between items-start mb-3">
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-neutral-200">
            {p.category}
          </span>
        </div>
        <h3 className="font-bold text-gray-200 group-hover:text-white transition-colors text-lg leading-tight">{p.name}</h3>
        <p className="text-xs text-gray-500 mt-1 font-mono tracking-wide">{p.barcode}</p>
      </div>
      <div className="mt-5 flex justify-between items-end relative z-10">
        <span className="text-xl font-extrabold text-neutral-200">Rs. {p.price.toFixed(2)}</span>
        {p.stock === 0 ? (
          <span className="text-[10px] font-black uppercase tracking-wider text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-1 rounded-lg">Out of stock</span>
        ) : p.stock <= 5 ? (
          <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-950/40 border border-orange-500/30 px-2 py-1 rounded-lg">Low Stock: {p.stock}</span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-200 bg-emerald-950/30 border border-emerald-500/20 px-2 py-1 rounded-lg">Stock: {p.stock}</span>
        )}
      </div>
    </div>
  );
});

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All', ...cats.sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Categories Tabs */}
      <div className="flex overflow-x-auto p-4 gap-2 border-b border-white/5 bg-black/30 scrollbar-none z-10 relative shadow-sm">
        {categories.map(cat => {
          const Icon = getCategoryIcon(cat);
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-100 flex items-center gap-2 ${
                activeCategory === cat 
                  ? 'bg-white/20 text-white border border-white/40 shadow-sm' 
                  : 'glass-button text-gray-300 hover:text-white'
              }`}
            >
              <Icon size={16} className={activeCategory === cat ? 'text-white' : 'text-gray-400'} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative z-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map(p => (
            <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
          ))}
        </div>
      </div>
    </div>
  );
};
