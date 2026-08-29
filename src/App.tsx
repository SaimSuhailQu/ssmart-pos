import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useScanner } from './hooks/useScanner';
import { CartItem, Product, PaymentData } from './types';
import { ShoppingCart, PackageSearch, Printer, CheckCircle, LayoutGrid, PackageOpen, Users, Shield, BarChart3, History, DollarSign, Truck } from 'lucide-react';
import { ProductGrid } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { OrderControls } from './components/OrderControls';
import { PaymentModal } from './components/PaymentModal';
import { InventoryManager } from './components/InventoryManager';
import { ProductFormModal } from './components/ProductFormModal';
import { PinLogin } from './components/PinLogin';
import { CustomerManager } from './components/CustomerManager';
import { VendorManager } from './components/VendorManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SalesRecordManager } from './components/SalesRecordManager';
import { ExpenseManager } from './components/ExpenseManager';
import logoImg from './assets/ss_mart_logo.png';

const TAX_RATE = 0.0; // Tax removed
const t = (str: string) => str;

type ViewMode = 'POS' | 'INVENTORY' | 'CUSTOMERS' | 'ANALYTICS' | 'SALES_RECORD' | 'EXPENSES' | 'VENDORS';

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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [scannedNewProduct, setScannedNewProduct] = useState<Product | null>(null);
  const [nextSaleId, setNextSaleId] = useState<number>(1);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('ONLINE');
  const [discount, setDiscount] = useState<number>(0);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(navigator.onLine);

  // Enforce strict Role-Based Access Control view bounds
  useEffect(() => {
    if (!currentUser) return;
    if (viewMode === 'ANALYTICS' && currentUser.role !== 'Admin') {
      setViewMode('POS');
    }
    if ((viewMode === 'INVENTORY' || viewMode === 'CUSTOMERS' || viewMode === 'VENDORS') && currentUser.role === 'Cashier') {
      setViewMode('POS');
    }
  }, [viewMode, currentUser]);

  // Always refresh products in memory when switching back to POS
  useEffect(() => {
    if (currentUser && viewMode === 'POS') {
      loadProducts();
    }
  }, [viewMode]);

  // Listen to network connectivity and background sync engine updates
  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (window.api.onSyncStatusChanged) {
      window.api.onSyncStatusChanged((status) => {
        setSyncStatus(status);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOnline = isNetworkOnline && syncStatus === 'ONLINE';

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
  }, [currentUser]);

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

  // Pre-index products by barcode for 0ms instant scan lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.barcode) map.set(p.barcode.trim(), p);
    }
    return map;
  }, [products]);

  // Scanner handler with instant memory lookup
  const handleScan = useCallback(async (barcode: string) => {
    if (!currentUser) return;
    if (viewMode !== 'POS') return; 
    if (isPaymentOpen) return; 
    
    setError(null);
    setSuccess(null);
    const clean = barcode.trim();
    if (!clean) return;
    
    // Instant 0ms memory lookup (exact barcode, without leading zeroes, or product ID)
    const cleanNoZeros = clean.replace(/^0+/, '');
    const cachedProduct = productMap.get(clean) || 
      productMap.get(cleanNoZeros) ||
      products.find(p => p.barcode?.trim() === clean || p.barcode?.trim() === cleanNoZeros || String(p.id) === clean);

    if (cachedProduct) {
      addToCart(cachedProduct);
      setSuccess(`Added "${cachedProduct.name}" to cart`);
      return;
    }

    try {
      const product = await window.api.getProduct(clean);
      if (product) {
        addToCart(product);
        setSuccess(`Added "${product.name}" to cart`);
      } else {
        // Automatically open Add Product modal immediately with scanned barcode!
        setScannedNewProduct({
          id: 0,
          name: '',
          barcode: clean,
          price: 0,
          cost_price: 0,
          stock: 10,
          category: 'General'
        });
        setIsQuickAddOpen(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error scanning product');
    }
  }, [viewMode, isPaymentOpen, currentUser, productMap, products]);

  // List of all valid barcodes for 0ms instant matching during scan
  const validBarcodes = useMemo(() => {
    const list: string[] = [];
    for (const p of products) {
      if (p.barcode) {
        const b = p.barcode.trim();
        list.push(b);
        const bNoZeros = b.replace(/^0+/, '');
        if (bNoZeros && bNoZeros !== b) list.push(bNoZeros);
      }
    }
    return list;
  }, [products]);

  useScanner(handleScan, validBarcodes, viewMode);

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

  const handleSaveQuickProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      const newId = await window.api.addProduct(productData);
      const createdProduct: Product = {
        id: newId,
        ...productData
      };
      await loadProducts();
      addToCart(createdProduct);
      setSuccess(`Product "${createdProduct.name}" registered and added to cart!`);
      setIsQuickAddOpen(false);
      setScannedNewProduct(null);
    } catch (err: any) {
      setError(err.message || 'Failed to add scanned product.');
    }
  };

  const handleCheckoutConfirm = async (paymentData: PaymentData) => {
    if (!currentUser) return;
    try {
      const res = await window.api.checkout({ 
        items: cart, 
        paymentData, 
        userId: currentUser.id,
        cashierName: currentUser.name 
      });
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

  const [lowStockOnlyView, setLowStockOnlyView] = useState(false);

  // Compute low stock items count (stock <= 5)
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  // State references for instantaneous keyboard shortcut responses without stale closures or re-attachment lag
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const heldCartRef = useRef(heldCart);
  heldCartRef.current = heldCart;
  const isPaymentOpenRef = useRef(isPaymentOpen);
  isPaymentOpenRef.current = isPaymentOpen;
  const isCatalogOpenRef = useRef(isCatalogOpen);
  isCatalogOpenRef.current = isCatalogOpen;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Ultra-responsive zero-latency POS Keyboard Shortcuts Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentUserRef.current) return;
      
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInputFocused = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      if (e.key === 'Escape') {
        if (isPaymentOpenRef.current) {
          setIsPaymentOpen(false);
        } else if (isCatalogOpenRef.current) {
          setIsCatalogOpen(false);
        } else if (viewModeRef.current === 'POS' && cartRef.current.length > 0) {
          handleClear();
        }
        return;
      }

      if (viewModeRef.current !== 'POS') return;

      // F1 or Space (Space only when not typing inside an input) for Checkout / Payment
      if (e.key === 'F1' || (e.key === ' ' && !isInputFocused)) {
        e.preventDefault();
        if (cartRef.current.length > 0 && !isPaymentOpenRef.current) {
          setIsPaymentOpen(true);
          window.api.getNextSaleId().then(nextId => {
            setNextSaleId(nextId);
          }).catch(() => {});
        }
      } 
      // F2 for Hold / Resume
      else if (e.key === 'F2') {
        e.preventDefault();
        if (heldCartRef.current !== null) {
          handleResume();
        } else if (cartRef.current.length > 0) {
          handleHold();
        }
      }
      // F4 for Product Search / Catalog Toggle
      else if (e.key === 'F4') {
        e.preventDefault();
        setIsCatalogOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If no user is logged in, show PinLogin security overlay
  if (!currentUser) {
    return <PinLogin onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // Navigation Panel JSX helper
  const renderNavbar = () => (
    <div className="glass-panel py-1.5 px-3 rounded-2xl flex flex-wrap items-center justify-center gap-2 relative z-30 text-gray-100 shadow-xl flex-shrink-0">
      <button 
        onClick={() => setViewMode('POS')} 
        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
          viewMode === 'POS' 
            ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
            : 'text-gray-400 hover:text-white glass-button'
        }`}
      >
        <LayoutGrid size={15} /> POS Terminal
      </button>

      <button 
        onClick={() => setViewMode('SALES_RECORD')} 
        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
          viewMode === 'SALES_RECORD' 
            ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
            : 'text-gray-400 hover:text-white glass-button'
        }`}
      >
        <History size={15} /> Sales Records
      </button>

      {/* Admin and Manager exclusive tabs */}
      {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
        <>
          <button 
            onClick={() => {
              setLowStockOnlyView(false);
              setViewMode('INVENTORY');
            }} 
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 relative cursor-pointer ${
              viewMode === 'INVENTORY' 
                ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                : 'text-gray-400 hover:text-white glass-button'
            }`}
          >
            <PackageOpen size={15} /> Inventory
            {lowStockCount > 0 && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setLowStockOnlyView(true);
                  setViewMode('INVENTORY');
                }}
                className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-black animate-pulse hover:bg-amber-400 transition-colors shadow-[0_0_8px_rgba(245,158,11,0.6)] cursor-pointer"
                title={`${lowStockCount} items have low stock (≤ 5 units). Click to view.`}
              >
                {lowStockCount} LOW
              </span>
            )}
          </button>
          <button 
            onClick={() => setViewMode('CUSTOMERS')} 
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'CUSTOMERS' 
                ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                : 'text-gray-400 hover:text-white glass-button'
            }`}
          >
            <Users size={15} /> Customers & Khata
          </button>
          <button 
            onClick={() => setViewMode('VENDORS')} 
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'VENDORS' 
                ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                : 'text-gray-400 hover:text-white glass-button'
            }`}
          >
            <Truck size={15} /> Vendors & POs
          </button>
        </>
      )}

      {/* Admin exclusive tabs */}
      {currentUser.role === 'Admin' && (
        <button 
          onClick={() => setViewMode('ANALYTICS')} 
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'ANALYTICS' 
              ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
              : 'text-gray-400 hover:text-white glass-button'
          }`}
        >
          <BarChart3 size={15} /> Financials
        </button>
      )}

      <button 
        onClick={() => setViewMode('EXPENSES')} 
        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
          viewMode === 'EXPENSES' 
            ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
            : 'text-gray-400 hover:text-white glass-button'
        }`}
      >
        <DollarSign size={15} /> Expenses
      </button>

      {/* Direct User Logout Button */}
      <button 
        onClick={() => setCurrentUser(null)} 
        className="px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 glass-button cursor-pointer ml-auto"
        title="Lock POS / Logout Current User"
      >
        <Shield size={15} /> Logout ({currentUser.name})
      </button>
    </div>
  );

  // Render Inventory View
  if (viewMode === 'INVENTORY') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit selection:bg-white/30 bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <InventoryManager 
            initialLowStockOnly={lowStockOnlyView} 
            onProductsUpdated={loadProducts}
          />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render CRM/Customer View
  if (viewMode === 'CUSTOMERS') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <CustomerManager />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render Vendor View
  if (viewMode === 'VENDORS') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <VendorManager />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render Analytics View
  if (viewMode === 'ANALYTICS') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <AnalyticsDashboard />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render Sales Records View
  if (viewMode === 'SALES_RECORD') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <SalesRecordManager />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render Expenses View
  if (viewMode === 'EXPENSES') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0">
          <ExpenseManager currentUser={currentUser} />
        </div>
        {renderNavbar()}
      </div>
    );
  }

  // Render POS View
  return (
    <div className="flex flex-col h-screen font-outfit selection:bg-white/30 bg-transparent p-2.5 gap-2 overflow-hidden">
      <div className="flex flex-1 overflow-hidden gap-4 rounded-3xl">
        {/* Left side: Collapsible Product Catalog Panel */}
        {isCatalogOpen && (
          <div className="w-[420px] flex flex-col glass-panel rounded-3xl overflow-hidden relative z-10 border-white/5 animate-in slide-in-from-left-4 duration-300">
            <header className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">{t('Product Catalog')}</h2>
              <button 
                onClick={() => setIsCatalogOpen(false)}
                className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
              >
                {t('Close')}
              </button>
            </header>
            <ProductGrid products={products} onAddToCart={addToCart} />
          </div>
        )}

        {/* Center: Streamlined active scanned order list (Primary Panel) */}
        <div className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative z-10 border-white/5">
          <header className="p-6 border-b border-white/5 bg-black/20 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <img src={logoImg} alt="SS Mart Logo" className="w-11 h-11 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(255, 255, 255, 0.3)] object-cover" />
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-neutral-200 to-neutral-500 drop-shadow-md">{t('SS MART')}</h1>
                  {/* Glowing Cloud Status Indicator */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest border transition-all duration-500 uppercase ${
                    isOnline
                      ? 'bg-white/10 text-neutral-200 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-200 font-bold uppercase tracking-widest mt-0.5">{t('Advanced Terminal')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Catalog toggler */}
              <button 
                onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider ${
                  isCatalogOpen 
                    ? 'bg-white/20 text-neutral-200 border border-white/50 shadow-[0_0_15px_rgba(255, 255, 255, 0.2)] font-black'
                    : 'text-gray-400 hover:text-white glass-button'
                }`}
              >
                <LayoutGrid size={16} /> {isCatalogOpen ? 'Close Catalog' : 'Browse Catalog'}
              </button>

              <form onSubmit={handleManualAdd} className="relative group w-72 overflow-hidden rounded-xl">
                 <div className="absolute inset-0 pointer-events-none z-20">
                   {/* Active Laser Sweep */}
                   <div className="absolute left-0 right-0 h-[1.5px] bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-laser pointer-events-none" />
                 </div>
                 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-neutral-200 transition-colors z-25">
                   <PackageSearch size={18} />
                 </div>
                 <input 
                   type="text" 
                   placeholder="Enter Barcode..." 
                   value={manualBarcode}
                   onChange={e => setManualBarcode(e.target.value)}
                   className="w-full glass-input rounded-xl block pl-12 p-3 relative z-10"
                 />
              </form>
            </div>
          </header>

          {/* Notifications block */}
          <div className="px-6 pt-4 flex-shrink-0 empty:hidden">
            {error && (
              <div className="mb-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md flex items-start gap-2 animate-in fade-in zoom-in-95">
                <div className="mt-0.5">⚠️</div>
                <div>{error}</div>
              </div>
            )}
            {success && (
              <div className="mb-2 p-3 bg-white/10 border border-emerald-500/20 text-neutral-200 rounded-xl text-sm backdrop-blur-md flex items-start gap-2 animate-in fade-in zoom-in-95">
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
                <div>{success}</div>
              </div>
            )}
          </div>

          <Cart cart={cart} onUpdateQty={updateQty} onRemoveItem={removeItem} />
        </div>

        {/* Right side: Checkout Summary Panel */}
        <div className="w-[400px] flex flex-col glass-panel rounded-3xl overflow-hidden relative z-20 border-white/5">
          <header className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">
            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
              <ShoppingCart size={20} className="text-neutral-200 drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.8)]" /> Checkout Summary
            </h2>
          </header>

          <OrderControls 
            onHold={handleHold} 
            onResume={handleResume} 
            onClear={handleClear} 
            isOrderHeld={heldCart !== null} 
            cartIsEmpty={cart.length === 0} 
          />

          {/* Quick Discount Selector */}
          {cart.length > 0 && (
            <div className="px-5 py-3 border-t border-white/5 bg-black/10 flex-shrink-0">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">{t('Apply Promo / Discount')}</span>
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
                          ? 'bg-white/20 text-neutral-200 border-white/50 shadow-[0_0_8px_rgba(255, 255, 255, 0.2)]'
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
                    {t('Clear')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-6 border-t border-white/5 bg-black/30 backdrop-blur-md relative overflow-hidden flex-1 flex flex-col justify-end">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[50px] -mr-10 -mt-10 rounded-full"></div>
            
            <div className="space-y-3 mb-6 relative z-10">
              <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                <span>{t('Items')}</span>
                <span className="text-gray-200">{totalItems}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-400">
                <span>{t('Subtotal')}</span>
                <span className="text-gray-200">Rs. {subtotal.toFixed(2)}</span>
              </div>
              {activeDiscount > 0 && (
                <div className="flex justify-between items-center text-sm font-medium text-neutral-200 animate-in slide-in-from-top-1">
                  <span>{t('Promo Discount')}</span>
                  <span>-Rs. {activeDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/10">
                <span className="text-xl font-bold text-white">{t('Total')}</span>
                <span className="text-3xl font-extrabold text-neutral-200 drop-shadow-[0_0_10px_rgba(255, 255, 255, 0.5)]">Rs. {totalAmount.toFixed(2)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                window.api.getNextSaleId().then(nextId => {
                  setNextSaleId(nextId);
                  setIsPaymentOpen(true);
                }).catch(() => {
                  setIsPaymentOpen(true);
                });
              }}
              disabled={cart.length === 0}
              className="w-full py-4 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(255, 255, 255, 0.3)] bg-gradient-to-r from-neutral-200 to-neutral-500 hover:from-neutral-200 hover:to-neutral-500 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:shadow-none transition-all flex justify-center items-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Printer size={20} className="relative z-10" />
              <span className="relative z-10 tracking-wider">{t('PAY (F1 / Space)')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Cashier POS Keyboard Shortcuts Bar */}
      <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-gray-400 bg-black/40 border border-white/5 py-1.5 px-4 rounded-xl backdrop-blur-md self-center">
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded font-mono border border-white/15">F1</kbd> or <kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded font-mono border border-white/15">Space</kbd> Checkout</span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded font-mono border border-white/15">F2</kbd> Hold/Resume Order</span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded font-mono border border-white/15">F4</kbd> Search Catalog</span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 text-white rounded font-mono border border-white/15">Esc</kbd> Void / Close</span>
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
          items={cart}
          onClose={() => setIsPaymentOpen(false)}
          onConfirm={handleCheckoutConfirm}
          nextSaleId={nextSaleId}
        />
      )}

      {/* Quick Add Modal on Scanning Unregistered Barcode */}
      {isQuickAddOpen && (
        <ProductFormModal
          product={scannedNewProduct}
          existingCategories={Array.from(new Set(products.map(p => p.category))).filter(Boolean)}
          onClose={() => {
            setIsQuickAddOpen(false);
            setScannedNewProduct(null);
          }}
          onSave={handleSaveQuickProduct}
        />
      )}
    </div>
  );
};

export default App;
