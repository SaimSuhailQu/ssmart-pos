import React, { useState, useEffect, useCallback } from 'react';
import { useScanner } from './hooks/useScanner';
import { CartItem, Product, PaymentData } from './types';
import { ShoppingCart, PackageSearch, Printer, CheckCircle, LayoutGrid, PackageOpen, Users, Shield, BarChart3 } from 'lucide-react';
import { ProductGrid } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { OrderControls } from './components/OrderControls';
import { PaymentModal } from './components/PaymentModal';
import { InventoryManager } from './components/InventoryManager';
import { PinLogin } from './components/PinLogin';
import { CustomerManager } from './components/CustomerManager';
import { ShiftManager } from './components/ShiftManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import logoImg from './assets/ss_mart_logo.png';

const TAX_RATE = 0.08; // 8%

type ViewMode = 'POS' | 'INVENTORY' | 'CUSTOMERS' | 'SHIFT' | 'ANALYTICS';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('POS');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldCart, setHeldCart] = useState<CartItem[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('SYNCED');
  const [discount, setDiscount] = useState<number>(0);

  // Enforce strict Role-Based Access Control view bounds
  useEffect(() => {
    if (!currentUser) return;
    if (viewMode === 'ANALYTICS' && currentUser.role !== 'Admin') {
      setViewMode('POS');
    }
    if ((viewMode === 'INVENTORY' || viewMode === 'CUSTOMERS') && currentUser.role === 'Cashier') {
      setViewMode('POS');
    }
  }, [viewMode, currentUser]);

  // Listen to background sync engine updates
  useEffect(() => {
    if (window.api.onSyncStatusChanged) {
      window.api.onSyncStatusChanged((status) => {
        setSyncStatus(status);
      });
    }
  }, []);

  // Initial load
  const loadProducts = async () => {
    try {
      const data = await window.api.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadProducts();
    }
  }, [viewMode, currentUser]);

  // Notifications clearer
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Calculations
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const activeDiscount = Math.min(discount, subtotal); 
  const tax = Math.max(0, subtotal - activeDiscount) * TAX_RATE;
  const totalAmount = Math.max(0, subtotal + tax - activeDiscount);

  // Scanner handler
  const handleScan = useCallback(async (barcode: string) => {
    if (!currentUser) return;
    if (viewMode !== 'POS') return; 
    if (isPaymentOpen) return; 
    
    setError(null);
    setSuccess(null);
    try {
      const product = await window.api.getProduct(barcode);
      if (product) {
        addToCart(product);
      } else {
        setError(`Product not found for barcode: ${barcode}`);
      }
    } catch (err: any) {
      setError(err.message || 'Error scanning product');
    }
  }, [viewMode, isPaymentOpen, currentUser]);

  useScanner(handleScan);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          setError(`Cannot add more "${product.name}". Only ${product.stock} items are in stock!`);
          return prev;
        }
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      if (product.stock <= 0) {
        setError(`"${product.name}" is out of stock!`);
        return prev;
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        if (newQty > item.stock) {
          setError(`Cannot exceed available inventory limit of ${item.stock} items for "${item.name}"!`);
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      handleScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  const handleHold = () => {
    setHeldCart(cart);
    setCart([]);
    setDiscount(0);
    setSuccess('Order placed on hold.');
  };

  const handleResume = () => {
    setCart(heldCart || []);
    setHeldCart(null);
    setDiscount(0);
    setSuccess('Order resumed.');
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to void this order?")) {
      setCart([]);
      setDiscount(0);
    }
  };

  const handleCheckoutConfirm = async (paymentData: PaymentData) => {
    if (!currentUser) return;
    try {
      const res = await window.api.checkout({ items: cart, paymentData, userId: currentUser.id });
      if (res.success) {
        setSuccess(`Sale #${res.saleId} completed!`);
        setCart([]);
        setDiscount(0);
        setIsPaymentOpen(false);
        loadProducts(); 
      }
    } catch (err: any) {
      setError(err.message || 'Checkout failed');
    }
  };

  // Keyboard shortcut for checkout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentUser) return;
      if (viewMode !== 'POS') return;
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      } else if (e.key === 'Escape' && isPaymentOpen) {
        setIsPaymentOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isPaymentOpen, viewMode, currentUser]);

  // If no user is logged in, show PinLogin security overlay
  if (!currentUser) {
    return <PinLogin onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Navigation Panel JSX helper
  const renderNavbar = () => (
    <div className="glass-panel p-3 rounded-2xl flex justify-center gap-4 relative z-50 text-gray-100">
      <button 
        onClick={() => setViewMode('POS')} 
        className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${
          viewMode === 'POS' 
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
            : 'text-gray-400 hover:text-white glass-button'
        }`}
      >
        <LayoutGrid size={18} /> POS Terminal
      </button>

      {/* Admin and Manager exclusive tabs */}
      {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
        <>
          <button 
            onClick={() => setViewMode('INVENTORY')} 
            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${
              viewMode === 'INVENTORY' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                : 'text-gray-400 hover:text-white glass-button'
            }`}
          >
            <PackageOpen size={18} /> Inventory Manager
          </button>
          <button 
            onClick={() => setViewMode('CUSTOMERS')} 
            className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${
              viewMode === 'CUSTOMERS' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                : 'text-gray-400 hover:text-white glass-button'
            }`}
          >
            <Users size={18} /> CRM & Loyalty
          </button>
        </>
      )}

      {/* Admin exclusive tabs */}
      {currentUser.role === 'Admin' && (
        <button 
          onClick={() => setViewMode('ANALYTICS')} 
          className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${
            viewMode === 'ANALYTICS' 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
              : 'text-gray-400 hover:text-white glass-button'
          }`}
        >
          <BarChart3 size={18} /> Financials
        </button>
      )}

      <button 
        onClick={() => setViewMode('SHIFT')} 
        className={`px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 ${
          viewMode === 'SHIFT' 
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
            : 'text-gray-400 hover:text-white glass-button'
        }`}
      >
        <Shield size={18} /> Staff Shift
      </button>
    </div>
  );

  // Render Inventory View
  if (viewMode === 'INVENTORY') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit selection:bg-indigo-500/30 bg-transparent p-4">
        <div className="flex-1 overflow-hidden">
          <InventoryManager onBackToPOS={() => setViewMode('POS')} />
        </div>
        <div className="mt-4">
          {renderNavbar()}
        </div>
      </div>
    );
  }

  // Render CRM/Customer View
  if (viewMode === 'CUSTOMERS') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-4">
        <div className="flex-1 overflow-hidden">
          <CustomerManager />
        </div>
        <div className="mt-4">
          {renderNavbar()}
        </div>
      </div>
    );
  }

  // Render Analytics View
  if (viewMode === 'ANALYTICS') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-4">
        <div className="flex-1 overflow-hidden">
          <AnalyticsDashboard />
        </div>
        <div className="mt-4">
          {renderNavbar()}
        </div>
      </div>
    );
  }

  // Render Staff Shift View
  if (viewMode === 'SHIFT') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-4">
        <div className="flex-1 overflow-hidden">
          <ShiftManager currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
        </div>
        <div className="mt-4">
          {renderNavbar()}
        </div>
      </div>
    );
  }

  // Render POS View
  return (
    <div className="flex flex-col h-screen font-outfit selection:bg-cyan-500/30 bg-transparent p-4 gap-4">
      <div className="flex flex-1 overflow-hidden gap-4 rounded-3xl">
        {/* Left side: Products Grid & Search */}
        <div className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative z-10 border-white/5">
          <header className="p-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <img src={logoImg} alt="SS Mart Logo" className="w-11 h-11 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(0,240,255,0.3)] object-cover" />
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 drop-shadow-md">SS MART</h1>
                  {/* Glowing Cloud Status Indicator */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest border transition-all duration-500 uppercase ${
                    syncStatus === 'SYNCED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : syncStatus === 'OFFLINE'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      syncStatus === 'SYNCED' ? 'bg-emerald-400' : syncStatus === 'OFFLINE' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    {syncStatus === 'SYNCED' ? 'Cloud Active' : syncStatus === 'OFFLINE' ? 'Local Only' : 'Connecting'}
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-0.5">Advanced Terminal</p>
              </div>
            </div>
            <form onSubmit={handleManualAdd} className="relative group w-72">
               <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-cyan-400 transition-colors">
                 <PackageSearch size={18} />
               </div>
               <input 
                 type="text" 
                 placeholder="Enter Barcode..." 
                 value={manualBarcode}
                 onChange={e => setManualBarcode(e.target.value)}
                 className="w-full glass-input rounded-xl block pl-12 p-3"
               />
            </form>
          </header>

          <ProductGrid products={products} onAddToCart={addToCart} />
        </div>

        {/* Right side: Shopping Cart & Totals */}
        <div className="w-[400px] flex flex-col glass-panel rounded-3xl overflow-hidden relative z-20 border-white/5">
          <header className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <ShoppingCart size={20} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" /> Current Order
            </h2>
          </header>

          <OrderControls 
            onHold={handleHold} 
            onResume={handleResume} 
            onClear={handleClear} 
            isOrderHeld={heldCart !== null} 
            cartIsEmpty={cart.length === 0} 
          />

          {/* Notifications */}
          <div className="px-5 pt-4 flex-shrink-0 empty:hidden">
            {error && (
              <div className="mb-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md flex items-start gap-2 animate-in fade-in zoom-in-95">
                <div className="mt-0.5">⚠️</div>
                <div>{error}</div>
              </div>
            )}
            {success && (
              <div className="mb-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm backdrop-blur-md flex items-start gap-2 animate-in fade-in zoom-in-95">
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
                <div>{success}</div>
              </div>
            )}
          </div>

          <Cart cart={cart} onUpdateQty={updateQty} onRemoveItem={removeItem} />

          {/* Quick Discount Selector */}
          {cart.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 bg-black/10 flex-shrink-0">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Apply Promo / Discount</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { label: '5%', type: 'pct', value: 0.05 },
                  { label: '10%', type: 'pct', value: 0.10 },
                  { label: '15%', type: 'pct', value: 0.15 },
                  { label: 'Rs. 100', type: 'flat', value: 100 },
                  { label: 'Rs. 500', type: 'flat', value: 500 },
                ].map((promo, idx) => {
                  const calculatedVal = promo.type === 'pct' ? subtotal * promo.value : promo.value;
                  const isActive = Math.abs(discount - calculatedVal) < 0.01;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setDiscount(calculatedVal);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase whitespace-nowrap border transition-all ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {promo.label}
                    </button>
                  );
                })}
                {discount > 0 && (
                  <button
                    onClick={() => setDiscount(0)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-6 border-t border-white/5 bg-black/30 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] -mr-10 -mt-10 rounded-full"></div>
            
            <div className="space-y-3 mb-6 relative z-10">
              <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                <span>Items</span>
                <span className="text-gray-200">{totalItems}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                <span>Subtotal</span>
                <span className="text-gray-200">Rs. {subtotal.toFixed(2)}</span>
              </div>
              {activeDiscount > 0 && (
                <div className="flex justify-between items-center text-sm font-medium text-emerald-400 animate-in slide-in-from-top-1">
                  <span>Promo Discount</span>
                  <span>-Rs. {activeDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
                <span className="text-gray-200">Rs. {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/10">
                <span className="text-xl font-bold text-white">Total</span>
                <span className="text-3xl font-extrabold text-cyan-400 drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">Rs. {totalAmount.toFixed(2)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsPaymentOpen(true)}
              disabled={cart.length === 0}
              className="w-full py-4 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(0,240,255,0.3)] bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:shadow-none transition-all flex justify-center items-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Printer size={20} className="relative z-10" />
              <span className="relative z-10 tracking-wider">PAY (F12)</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Bar at Bottom */}
      {renderNavbar()}

      {/* Payment Modal Overlay */}
      {isPaymentOpen && (
        <PaymentModal 
          subtotal={subtotal}
          tax={tax}
          discount={activeDiscount}
          total={totalAmount}
          onClose={() => setIsPaymentOpen(false)}
          onConfirm={handleCheckoutConfirm}
        />
      )}
    </div>
  );
};

export default App;
