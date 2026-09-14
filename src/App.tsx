import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useScanner } from './hooks/useScanner';
import { CartItem, Product, PaymentData } from './types';
import { ShoppingCart, PackageSearch, Printer, CheckCircle, LayoutGrid, PackageOpen, Users, Shield, BarChart3, History, DollarSign, Truck, RefreshCw, Sparkles, PlusCircle } from 'lucide-react';
import { ProductGrid } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { OrderControls } from './components/OrderControls';
import { PaymentModal } from './components/PaymentModal';
import { InventoryManager } from './components/InventoryManager';
import { ProductFormModal } from './components/ProductFormModal';
import { CustomItemModal } from './components/CustomItemModal';
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
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scannedNewProduct, setScannedNewProduct] = useState<Product | null>(null);
  const [nextSaleId, setNextSaleId] = useState<number>(1);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('ONLINE');
  const [discount, setDiscount] = useState<number>(0);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(navigator.onLine);
  const [updateInfo, setUpdateInfo] = useState<{ status: string; version?: string } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);

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

  // Listen to network connectivity, background sync engine, and auto-updater updates
  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let unsubSync: (() => void) | undefined;
    if (window.api.onSyncStatusChanged) {
      unsubSync = window.api.onSyncStatusChanged((status) => {
        setSyncStatus(status);
      });
    }

    let unsubUpdater: (() => void) | undefined;
    if (window.api.onUpdaterStatus) {
      unsubUpdater = window.api.onUpdaterStatus((info) => {
        console.log('[Updater Status]:', info);
        setIsCheckingUpdate(false);
        if (info.status === 'downloaded' || info.status === 'available') {
          setUpdateInfo(info);
          setSuccess(`Update found: ${info.version || 'New version'}. Downloading in background...`);
        } else if (info.status === 'up-to-date') {
          setSuccess('MART POS is already on the latest version!');
        } else if (info.status === 'error') {
          setError(info.error ? `Update check error: ${info.error}` : 'Could not check for updates.');
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubSync) unsubSync();
      if (unsubUpdater) unsubUpdater();
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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Error scanning product');
    }
  }, [viewMode, isPaymentOpen, currentUser, productMap, products]);

  // Set of all valid barcodes for 0ms instant matching during scan
  const validBarcodes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.barcode) {
        const b = p.barcode.trim();
        set.add(b);
        const bNoZeros = b.replace(/^0+/, '');
        if (bNoZeros && bNoZeros !== b) set.add(bNoZeros);
      }
    }
    return set;
  }, [products]);

  useScanner(handleScan, validBarcodes, viewMode);

  const addToCart = (product: Product, qtyToAdd = 1) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        if (existing.qty + qtyToAdd > product.stock) {
          setError(`Cannot add ${qtyToAdd} more "${product.name}". Only ${product.stock} items are in stock!`);
          return prev;
        }
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + qtyToAdd } : p);
      }
      if (product.stock < qtyToAdd) {
        setError(`"${product.name}" has only ${product.stock} in stock!`);
        return prev;
      }
      return [...prev, { ...product, qty: qtyToAdd }];
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
    const query = manualBarcode.trim();
    if (!query) return;

    // If dropdown is open and an item is selected from filtered list
    if (isSearchDropdownOpen && matchingProducts.length > 0) {
      const selected = matchingProducts[Math.min(searchSelectedIndex, matchingProducts.length - 1)];
      if (selected) {
        addToCart(selected);
        setSuccess(`Added "${selected.name}" to cart`);
        setManualBarcode('');
        setIsSearchDropdownOpen(false);
        return;
      }
    }

    handleScan(query);
    setManualBarcode('');
    setIsSearchDropdownOpen(false);
  };

  const handleAddCustomItem = async (item: { name: string; price: number; qty: number; category: string }) => {
    try {
      const customBarcode = `CUSTOM-${Date.now()}`;
      const newId = await window.api.addProduct({
        name: item.name,
        barcode: customBarcode,
        price: item.price,
        cost_price: item.price,
        stock: 9999,
        category: item.category || 'General'
      });

      const newProduct: Product = {
        id: newId,
        name: item.name,
        barcode: customBarcode,
        price: item.price,
        cost_price: item.price,
        stock: 9999,
        category: item.category || 'General'
      };

      await loadProducts();
      addToCart(newProduct, item.qty);
      setSuccess(`Added custom item "${item.name}" (x${item.qty}) to cart!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to add custom item.');
    }
  };

  // Search and filter catalog live products for interactive search dropdown
  const matchingProducts = useMemo(() => {
    const query = manualBarcode.trim().toLowerCase();
    if (!query || query.length < 1) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      String(p.id) === query
    ).slice(0, 12);
  }, [products, manualBarcode]);

  // Keep search selection index in bounds
  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [manualBarcode]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Failed to add scanned product.');
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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setError(errMessage || 'Checkout failed');
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
        if (isSearchDropdownOpen) {
          setIsSearchDropdownOpen(false);
        } else if (isCustomItemOpen) {
          setIsCustomItemOpen(false);
        } else if (isPaymentOpenRef.current) {
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
          }).catch(err => {
            console.warn('Failed to fetch next sale id:', err);
          });
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
      // F3 for Custom Item Add
      else if (e.key === 'F3') {
        e.preventDefault();
        setIsCustomItemOpen(prev => !prev);
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
    <nav className="enterprise-card py-2 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 relative z-30 text-slate-200 shadow-lg flex-shrink-0 border-slate-800">
      {/* Left: Operational Modes */}
      <div className="flex items-center gap-1.5">
        <button 
          onClick={() => setViewMode('POS')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'POS' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <LayoutGrid size={15} /> POS Terminal
        </button>

        <button 
          onClick={() => setViewMode('SALES_RECORD')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'SALES_RECORD' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History size={15} /> Sales Records
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-1.5" />

        {/* Admin and Manager exclusive tabs */}
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <>
            <button 
              onClick={() => {
                setLowStockOnlyView(false);
                setViewMode('INVENTORY');
              }} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 relative cursor-pointer ${
                viewMode === 'INVENTORY' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                  className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer"
                  title={`${lowStockCount} items have low stock (≤ 5 units). Click to view.`}
                >
                  {lowStockCount} LOW
                </span>
              )}
            </button>
            <button 
              onClick={() => setViewMode('CUSTOMERS')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'CUSTOMERS' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users size={15} /> Customers & Khata
            </button>
            <button 
              onClick={() => setViewMode('VENDORS')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'VENDORS' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'ANALYTICS' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 size={15} /> Financials
          </button>
        )}

        <button 
          onClick={() => setViewMode('EXPENSES')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'EXPENSES' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <DollarSign size={15} /> Expenses
        </button>
      </div>

      {/* Right: Updater & User session */}
      <div className="flex items-center gap-2 ml-auto">
        {updateInfo?.status === 'downloaded' && (
          <button
            onClick={() => window.api.quitAndInstallUpdate()}
            className="px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 animate-pulse cursor-pointer shadow-sm"
            title="Click to restart and apply new version"
          >
            <Sparkles size={14} /> Restart POS ({updateInfo.version || 'New'})
          </button>
        )}

        {/* Manual Check For Updates */}
        <button
          onClick={async () => {
            if (isCheckingUpdate) return;
            setIsCheckingUpdate(true);
            setError(null);
            try {
              const res = await window.api.checkForUpdates();
              if (res.message) {
                setSuccess(res.message);
              }
              if (res.error) {
                setError(res.error);
                setIsCheckingUpdate(false);
              }
            } catch (err: unknown) {
              const errMessage = err instanceof Error ? err.message : String(err);
              setError(errMessage || 'Failed to check for updates.');
              setIsCheckingUpdate(false);
            }
          }}
          disabled={isCheckingUpdate}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Check GitHub for newer version of MART POS"
        >
          <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin text-indigo-400' : ''} />
          <span>{isCheckingUpdate ? 'Checking...' : 'Check Updates'}</span>
        </button>

        {/* User Session & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            <span className="text-slate-200 font-semibold">{currentUser.name}</span> ({currentUser.role})
          </span>
          <button 
            onClick={() => setCurrentUser(null)} 
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center gap-1.5 cursor-pointer"
            title="Lock POS / Logout Current User"
          >
            <Shield size={14} /> Lock
          </button>
        </div>
      </div>
    </nav>
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
    <div className="flex flex-col h-screen font-sans bg-transparent p-3 gap-2.5 overflow-hidden">
      <div className="flex flex-1 overflow-hidden gap-3 rounded-2xl">
        {/* Left side: Collapsible Product Catalog Panel */}
        {isCatalogOpen && (
          <div className="w-[420px] flex flex-col enterprise-card rounded-xl overflow-hidden relative z-10 border-slate-800 animate-in slide-in-from-left-3 duration-200">
            <header className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">{t('Product Catalog')}</h2>
              <button 
                onClick={() => setIsCatalogOpen(false)}
                className="text-xs text-slate-400 hover:text-white font-medium"
              >
                {t('Close')}
              </button>
            </header>
            <ProductGrid products={products} onAddToCart={addToCart} />
          </div>
        )}

        {/* Center: Streamlined active scanned order list (Primary Panel) */}
        <div className="flex-1 flex flex-col enterprise-card rounded-xl overflow-hidden relative z-10 border-slate-800">
          <header className="p-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="SS Mart Logo" className="w-10 h-10 rounded-lg border border-slate-700 object-cover shadow-sm" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white">{t('SS MART POS')}</h1>
                  {/* Cloud Status Indicator */}
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border uppercase ${
                    isOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                    }`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Terminal ID: #01 • Cashier: {currentUser.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Custom Item Button (Mobile Parity) */}
              <button
                onClick={() => setIsCustomItemOpen(true)}
                className="px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 text-xs cursor-pointer bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:border-indigo-500/60 shadow-sm"
                title="Add ad-hoc or custom item to current order (F3)"
              >
                <PlusCircle size={15} /> Custom Item (F3)
              </button>

              {/* Catalog toggler */}
              <button 
                onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 text-xs cursor-pointer ${
                  isCatalogOpen 
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700 hover:border-slate-600'
                }`}
              >
                <LayoutGrid size={15} /> {isCatalogOpen ? 'Close Catalog' : 'Catalog (F4)'}
              </button>

              {/* Live Interactive Catalog Search & Barcode Scan Bar */}
              <div ref={searchWrapperRef} className="relative group w-72">
                <form onSubmit={handleManualAdd}>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                    <PackageSearch size={16} />
                  </div>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Search product or scan barcode..." 
                    value={manualBarcode}
                    onFocus={() => {
                      if (manualBarcode.trim().length > 0) setIsSearchDropdownOpen(true);
                    }}
                    onChange={e => {
                      setManualBarcode(e.target.value);
                      setIsSearchDropdownOpen(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={e => {
                      if (!isSearchDropdownOpen || matchingProducts.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSearchSelectedIndex(prev => (prev + 1) % matchingProducts.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSearchSelectedIndex(prev => (prev - 1 + matchingProducts.length) % matchingProducts.length);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsSearchDropdownOpen(false);
                      }
                    }}
                    className="w-full glass-input rounded-lg block pl-9 py-1.5 px-3 text-xs text-white"
                  />
                </form>

                {/* Live Catalog Search Dropdown Menu */}
                {isSearchDropdownOpen && matchingProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800/60 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 bg-slate-950/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Catalog Matches ({matchingProducts.length})</span>
                      <span className="text-[9px] font-mono text-slate-500">↑↓ select • Enter adds</span>
                    </div>
                    {matchingProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        onMouseDown={e => {
                          e.preventDefault(); // prevent blur before click registers
                          addToCart(p);
                          setSuccess(`Added "${p.name}" to cart`);
                          setManualBarcode('');
                          setIsSearchDropdownOpen(false);
                        }}
                        onMouseEnter={() => setSearchSelectedIndex(idx)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          searchSelectedIndex === idx 
                            ? 'bg-indigo-600/25 border-l-2 border-indigo-500 text-white' 
                            : 'hover:bg-slate-800/50 text-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-semibold truncate leading-snug">{p.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60 text-[9px]">{p.category}</span>
                            <span>{p.barcode || `#${p.id}`}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-indigo-300">Rs. {p.price.toFixed(2)}</div>
                          <div className={`text-[10px] font-medium font-mono ${p.stock <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Notifications block */}
          <div className="px-5 pt-3 flex-shrink-0 empty:hidden">
            {error && (
              <div className="mb-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-start gap-2">
                <div className="mt-0.5">⚠️</div>
                <div>{error}</div>
              </div>
            )}
            {success && (
              <div className="mb-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-start gap-2">
                <CheckCircle size={15} className="mt-0.5 shrink-0" />
                <div>{success}</div>
              </div>
            )}
          </div>

          <Cart cart={cart} onUpdateQty={updateQty} onRemoveItem={removeItem} />
        </div>

        {/* Right side: Checkout Summary Panel */}
        <div className="w-[380px] flex flex-col enterprise-card rounded-xl overflow-hidden relative z-20 border-slate-800">
          <header className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <h2 className="text-sm font-bold flex items-center gap-2 text-white">
              <ShoppingCart size={16} className="text-indigo-400" /> Checkout Summary
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
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">{t('Quick Promo / Discount')}</span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
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
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium whitespace-nowrap border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      {promo.label}
                    </button>
                  );
                })}
                {discount > 0 && (
                  <button
                    onClick={() => setDiscount(0)}
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                  >
                    {t('Clear')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-5 border-t border-slate-800 bg-slate-950/70 flex-1 flex flex-col justify-end">
            <div className="space-y-2.5 mb-5 relative z-10">
              <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
                <span>{t('Line Items')}</span>
                <span className="text-slate-200 font-mono">{totalItems}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
                <span>{t('Subtotal')}</span>
                <span className="text-slate-200 font-mono tabular-nums">Rs. {subtotal.toFixed(2)}</span>
              </div>
              {activeDiscount > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-400 font-medium">
                  <span>{t('Promo Discount')}</span>
                  <span className="font-mono tabular-nums">-Rs. {activeDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-slate-800">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">{t('Amount Due')}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Tax Incl.</span>
                </div>
                <span className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">Rs. {totalAmount.toFixed(2)}</span>
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
              className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 transition-all flex justify-center items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
            >
              <Printer size={18} />
              <span className="tracking-wide text-xs uppercase font-bold">{t('CHECKOUT (F1 / Space)')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cashier POS Keyboard Shortcuts Bar */}
      <div className="flex items-center justify-center gap-6 text-[11px] font-medium text-slate-400 bg-slate-900/80 border border-slate-800 py-1.5 px-4 rounded-lg self-center">
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">F1</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">Space</kbd> Pay</span>
        <span className="text-slate-700">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">F2</kbd> Hold/Resume</span>
        <span className="text-slate-700">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">F3</kbd> Custom Item</span>
        <span className="text-slate-700">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">F4</kbd> Catalog</span>
        <span className="text-slate-700">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded font-mono border border-slate-700 text-[10px]">Esc</kbd> Void / Close</span>
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

      {/* Custom Item Modal */}
      <CustomItemModal
        isOpen={isCustomItemOpen}
        onClose={() => setIsCustomItemOpen(false)}
        onAdd={handleAddCustomItem}
        existingCategories={Array.from(new Set(products.map(p => p.category))).filter(Boolean)}
      />

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
