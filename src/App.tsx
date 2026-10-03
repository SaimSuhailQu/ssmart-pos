import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useScanner } from './hooks/useScanner';
import { usePosShortcuts } from './hooks/usePosShortcuts';
import { Product, PaymentData } from './types';
import { usePos, posActions, posStore } from './state/posStore';
import { toast } from './state/toast';
import { fromMinor } from './core/money';
import { ShoppingCart, PackageSearch, Printer, LayoutGrid, PackageOpen, Users, Shield, BarChart3, History, DollarSign, Truck, RefreshCw, Sparkles, PlusCircle } from 'lucide-react';
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
import { BarcodePrintManager } from './components/BarcodePrintManager';
import { LicenseGate } from './components/LicenseGate';
import { ToastHost } from './components/ui/Toast';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { PrintQueueBadge } from './components/pos/PrintQueueBadge';
import logoImg from './assets/ss_mart_logo.png';

const t = (str: string) => str;

const AppContent: React.FC = () => {
  // POS domain state lives in posStore (single source of truth, integer
  // money, pure cart rules). Local useState is only for view-local UI.
  const currentUser = usePos((s) => s.user);
  const viewMode = usePos((s) => s.view);
  const cart = usePos((s) => s.cart);
  const heldCart = usePos((s) => s.heldCart);
  const totals = usePos((s) => s.totals);
  const discountMinor = usePos((s) => s.discountMinor);
  const discount = discountMinor / 100;

  const [products, setProducts] = useState<Product[]>([]);

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
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(navigator.onLine);
  const [updateInfo, setUpdateInfo] = useState<{ status: string; version?: string } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);

  // Calculations — integer paisa from the store (no float drift).
  const totalItems = totals.itemCount;
  const subtotal = totals.subtotal.minor / 100;
  const activeDiscount = Math.min(discount, subtotal);
  const totalAmount = totals.total.minor / 100;

  // Role-based view bounds are enforced inside posStore (setUser/setView),
  // so no effect is needed here.

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
          toast.info(`Update found: ${info.version || 'New version'}. Downloading in background...`);
        } else if (info.status === 'up-to-date') {
          toast.success('MART POS is already on the latest version!');
        } else if (info.status === 'error') {
          toast.error(info.error ? `Update check error: ${info.error}` : 'Could not check for updates.');
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

  // Toast notifications auto-dismiss via ToastHost; no manual clearer needed.

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
    
    // (toasts auto-dismiss; nothing to clear)
    const clean = barcode.trim();
    if (!clean) return;

    console.log('[POS Scanner] Scanned raw barcode:', barcode, 'Cleaned:', clean);
    
    // Instant 0ms memory lookup (exact barcode, without leading zeroes, or product ID)
    const cleanNoZeros = clean.replace(/^0+/, '');
    const cachedProduct = productMap.get(clean) || 
      productMap.get(cleanNoZeros) ||
      products.find(p => p.barcode?.trim() === clean || p.barcode?.trim() === cleanNoZeros || String(p.id) === clean);

    if (cachedProduct) {
      console.log('[POS Scanner] Found in memory cache:', cachedProduct.name);
      if (addToCart(cachedProduct)) toast.success(`Added "${cachedProduct.name}" to cart`);
      return;
    }

    try {
      const product = await window.api.getProduct(clean);
      if (product) {
        console.log('[POS Scanner] Found via SQLite getProduct:', product.name);
        if (addToCart(product)) toast.success(`Added "${product.name}" to cart`);
      } else {
        console.warn('[POS Scanner] Barcode not found, opening quick-add modal:', clean);
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
      console.error('[POS Scanner] Error fetching product:', err);
      toast.error(errMessage || 'Error scanning product');
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

  const addToCart = (product: Product, qtyToAdd = 1): boolean => {
    // Domain rules (stock caps) + error toasts live in posActions.
    return posActions.addToCart(product, qtyToAdd);
  };

  const updateQty = (id: number, delta: number) => {
    const line = cart.find((l) => l.productId === id);
    if (!line) return;
    posActions.setQty(id, line.qty + delta);
  };

  const removeItem = (id: number) => {
    posActions.removeItem(id);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualBarcode.trim();
    if (!query) return;

    // Check if query is an exact barcode match first
    const exactMatch = productMap.get(query) || 
      productMap.get(query.replace(/^0+/, '')) ||
      products.find(p => p.barcode?.trim() === query || String(p.id) === query);

    if (exactMatch) {
      if (addToCart(exactMatch)) toast.success(`Added "${exactMatch.name}" to cart`);
      setManualBarcode('');
      setIsSearchDropdownOpen(false);
      return;
    }

    // If dropdown is open and an item is selected from filtered list
    if (isSearchDropdownOpen && matchingProducts.length > 0) {
      const selected = matchingProducts[Math.min(searchSelectedIndex, matchingProducts.length - 1)];
      if (selected) {
        if (addToCart(selected)) toast.success(`Added "${selected.name}" to cart`);
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
      if (addToCart(newProduct, item.qty)) toast.success(`Added custom item "${item.name}" (x${item.qty}) to cart!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Failed to add custom item.');
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
    posActions.holdCart();
  };

  const handleResume = () => {
    posActions.resumeHeldCart();
  };

  const [clearOrderConfirmOpen, setClearOrderConfirmOpen] = useState(false);

  const handleClear = () => {
    posActions.clearCart();
    setClearOrderConfirmOpen(false);
  };

  const handleSaveQuickProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      const newId = await window.api.addProduct(productData);
      const createdProduct: Product = {
        id: newId,
        ...productData
      };
      await loadProducts();
      if (addToCart(createdProduct)) {
        toast.success(`Product "${createdProduct.name}" registered and added to cart!`);
      }
      setIsQuickAddOpen(false);
      setScannedNewProduct(null);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      toast.error(errMessage || 'Failed to add scanned product.');
    }
  };

  const handleCheckoutConfirm = async (paymentData: PaymentData) => {
    if (!currentUser) return;
    try {
      // Bridge the domain cart to the legacy checkout payload (saveSale
      // expects the CartItem shape with major-unit prices).
      const legacyItems = cart.map((l) => ({
        id: l.productId,
        name: l.name,
        barcode: l.barcode,
        price: l.unitPrice.minor / 100,
        qty: l.qty,
        stock: l.stock,
        category: l.category,
      }));
      const res = await window.api.checkout({
        items: legacyItems,
        paymentData,
        userId: currentUser.id,
        cashierName: currentUser.name
      });
      if (res.success) {
        toast.success(`Sale #${res.saleId} completed!`);
        posActions.clearCart();
        setIsPaymentOpen(false);
        loadProducts();
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      toast.error(errMessage || 'Checkout failed');
    }
  };

  const [lowStockOnlyView, setLowStockOnlyView] = useState(false);

  // Compute low stock items count (stock <= 5) — memoized to avoid re-filter on every render
  const lowStockCount = useMemo(() => products.filter(p => p.stock <= 5).length, [products]);
  const existingCategories = useMemo(
    () => Array.from(new Set(products.map(p => p.category))).filter(Boolean),
    [products]
  );

  // Desktop keyboard shortcuts (F1/Space tender, F2 hold/resume, F3 custom
  // item, F4 catalog, F5 refresh, Esc close). The hook ref-forwards handlers
  // so the listener never goes stale — no manual ref mirroring needed.
  const openTender = useCallback(() => {
    const s = posStore.getState();
    if (s.view !== 'POS' || s.cart.length === 0 || isPaymentOpen) return;
    setIsPaymentOpen(true);
    window.api.getNextSaleId().then(setNextSaleId).catch((err) => {
      console.warn('Failed to fetch next sale id:', err);
    });
  }, [isPaymentOpen]);

  usePosShortcuts(
    {
      onTender: openTender,
      onHoldResume: () => {
        const s = posStore.getState();
        if (s.view !== 'POS') return;
        if (s.heldCart) posActions.resumeHeldCart();
        else posActions.holdCart();
      },
      onCustomItem: () => {
        if (posStore.getState().view !== 'POS') return;
        setIsCustomItemOpen((prev) => !prev);
      },
      onToggleCatalog: () => {
        if (posStore.getState().view !== 'POS') return;
        setIsCatalogOpen((prev) => !prev);
      },
      onRefreshCatalog: () => {
        loadProducts();
      },
      onEscape: () => {
        if (isSearchDropdownOpen) setIsSearchDropdownOpen(false);
        else if (isCustomItemOpen) setIsCustomItemOpen(false);
        else if (isPaymentOpen) setIsPaymentOpen(false);
        else if (isCatalogOpen) setIsCatalogOpen(false);
        else if (posStore.getState().view === 'POS' && posStore.getState().cart.length > 0) {
          setClearOrderConfirmOpen(true);
        }
      },
    },
    !!currentUser,
  );

  // If no user is logged in, show PinLogin security overlay
  if (!currentUser) {
    return <PinLogin onLoginSuccess={(user) => posActions.setUser(user)} />;
  }

  // Navigation Panel JSX helper
  const renderNavbar = () => (
    <nav className="enterprise-card py-2 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 relative z-30 text-content-primary shadow-lg flex-shrink-0 border-canvas-card">
      {/* Left: Operational Modes */}
      <div className="flex items-center gap-1.5">
        <button 
          onClick={() => posActions.setView('POS')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'POS' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
          }`}
        >
          <LayoutGrid size={15} /> POS Terminal
        </button>

        <button 
          onClick={() => posActions.setView('SALES_RECORD')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'SALES_RECORD' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
          }`}
        >
          <History size={15} /> Sales Records
        </button>

        <div className="h-4 w-[1px] bg-canvas-card mx-1.5" />

        {/* Admin and Manager exclusive tabs */}
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <>
            <button 
              onClick={() => {
                setLowStockOnlyView(false);
                posActions.setView('INVENTORY');
              }} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 relative cursor-pointer ${
                viewMode === 'INVENTORY' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
              }`}
            >
              <PackageOpen size={15} /> Inventory
              {lowStockCount > 0 && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setLowStockOnlyView(true);
                    posActions.setView('INVENTORY');
                  }}
                  className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-status-amber/20 text-status-amber border border-status-amber/40 hover:bg-status-amber/30 transition-colors cursor-pointer"
                  title={`${lowStockCount} items have low stock (≤ 5 units). Click to view.`}
                >
                  {lowStockCount} LOW
                </span>
              )}
            </button>
            <button 
              onClick={() => posActions.setView('CUSTOMERS')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'CUSTOMERS' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
              }`}
            >
              <Users size={15} /> Customers & Khata
            </button>
            <button 
              onClick={() => posActions.setView('VENDORS')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'VENDORS' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
              }`}
            >
              <Truck size={15} /> Vendors & POs
            </button>
            <button 
              onClick={() => posActions.setView('BARCODE_PRINT')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'BARCODE_PRINT' 
                  ? 'bg-violet-600 text-white shadow-sm' 
                  : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
              }`}
            >
              <Printer size={15} /> Barcode Printer
            </button>
          </>
        )}

        {/* Admin exclusive tabs */}
        {currentUser.role === 'Admin' && (
          <button 
            onClick={() => posActions.setView('ANALYTICS')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'ANALYTICS' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
            }`}
          >
            <BarChart3 size={15} /> Financials
          </button>
        )}

        <button 
          onClick={() => posActions.setView('EXPENSES')} 
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            viewMode === 'EXPENSES' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-content-secondary hover:text-white hover:bg-canvas-card/60'
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
            className="px-3 py-1.5 rounded-lg font-bold text-xs bg-status-emerald hover:brightness-110 text-canvas flex items-center gap-1.5 animate-pulse cursor-pointer shadow-sm"
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
            // (toasts auto-dismiss; nothing to clear)
            // Safety net: never leave the button stuck spinning if the updater
            // produces no status event (offline / unsupported platform).
            const resetTimer = setTimeout(() => setIsCheckingUpdate(false), 30000);
            try {
              const res = await window.api.checkForUpdates();
              if (res.message) {
                toast.success(res.message);
              }
              if (res.error) {
                toast.error(res.error);
              }
              // Progress streams through onUpdaterStatus; stop the spinner now
              // when the check could not even start.
              if (res.success === false) {
                clearTimeout(resetTimer);
                setIsCheckingUpdate(false);
              }
            } catch (err: unknown) {
              clearTimeout(resetTimer);
              const errMessage = err instanceof Error ? err.message : String(err);
              toast.error(errMessage || 'Failed to check for updates.');
              setIsCheckingUpdate(false);
            }
          }}
          disabled={isCheckingUpdate}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-content-secondary hover:text-white hover:bg-canvas-card/60 border border-transparent hover:border-canvas-hover transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Check GitHub for newer version of MART POS"
        >
          <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin text-indigo-400' : ''} />
          <span>{isCheckingUpdate ? 'Checking...' : 'Check Updates'}</span>
        </button>

        {/* User Session & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-canvas-card">
          <span className="text-xs text-content-secondary font-medium hidden sm:inline">
            <span className="text-content-primary font-semibold">{currentUser.name}</span> ({currentUser.role})
          </span>
          <button 
            onClick={() => { window.api.logout().catch(() => undefined); posActions.setUser(null); }} 
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-status-coral hover:text-status-coral hover:bg-status-coral/10 border border-status-coral/20 transition flex items-center gap-1.5 cursor-pointer"
            title="Lock POS / Logout Current User"
          >
            <Shield size={14} /> Lock
          </button>
        </div>
      </div>
    </nav>
  );

  // Render Barcode Print Manager View
  if (viewMode === 'BARCODE_PRINT') {
    return (
      <div className="h-screen w-full flex flex-col font-outfit bg-transparent p-2.5 gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0 enterprise-card rounded-xl border-canvas-card">
          <BarcodePrintManager />
        </div>
        {renderNavbar()}
      </div>
    );
  }

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
          <div className="w-[420px] flex flex-col enterprise-card rounded-xl overflow-hidden relative z-10 border-canvas-card animate-in slide-in-from-left-3 duration-200">
            <header className="p-4 border-b border-canvas-card bg-canvas-subtle/80 backdrop-blur-md flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-content-primary">{t('Product Catalog')}</h2>
              <button 
                onClick={() => setIsCatalogOpen(false)}
                className="text-xs text-content-secondary hover:text-white font-medium"
              >
                {t('Close')}
              </button>
            </header>
            <ProductGrid products={products} onAddToCart={addToCart} />
          </div>
        )}

        {/* Center: Streamlined active scanned order list (Primary Panel) */}
        <div className="flex-1 flex flex-col enterprise-card rounded-xl overflow-hidden relative z-10 border-canvas-card">
          <header className="p-4 border-b border-canvas-card bg-canvas-subtle/80 sticky top-0 z-20 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="SS Mart Logo" className="w-10 h-10 rounded-lg border border-canvas-hover object-cover shadow-sm" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white">{t('SS MART POS')}</h1>
                  {/* Cloud Status Indicator */}
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border uppercase ${
                    isOnline
                      ? 'bg-status-emerald/10 text-status-emerald border-status-emerald/30'
                      : 'bg-status-coral/10 text-status-coral border-status-coral/30 animate-pulse'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-status-emerald' : 'bg-status-coral'
                    }`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {/* Print spooler queue status */}
                  <PrintQueueBadge />
                </div>
                <p className="text-[11px] text-content-secondary font-mono mt-0.5">Terminal ID: #01 • Cashier: {currentUser.name}</p>
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
                    : 'text-content-secondary hover:text-white bg-canvas-card/80 border border-canvas-hover hover:border-canvas-hover'
                }`}
              >
                <LayoutGrid size={15} /> {isCatalogOpen ? 'Close Catalog' : 'Catalog (F4)'}
              </button>

              {/* Live Interactive Catalog Search & Barcode Scan Bar */}
              <div ref={searchWrapperRef} className="relative group w-72">
                <form onSubmit={handleManualAdd}>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-content-secondary group-focus-within:text-indigo-400 transition-colors">
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
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-canvas-subtle/95 backdrop-blur-md border border-canvas-hover/80 rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-canvas-card/60 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 bg-canvas/60 text-[10px] font-semibold text-content-secondary uppercase tracking-wider flex justify-between items-center">
                      <span>Catalog Matches ({matchingProducts.length})</span>
                      <span className="text-[9px] font-mono text-content-muted">↑↓ select • Enter adds</span>
                    </div>
                    {matchingProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        onMouseDown={e => {
                          e.preventDefault(); // prevent blur before click registers
                          if (addToCart(p)) toast.success(`Added "${p.name}" to cart`);
                          setManualBarcode('');
                          setIsSearchDropdownOpen(false);
                        }}
                        onMouseEnter={() => setSearchSelectedIndex(idx)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          searchSelectedIndex === idx 
                            ? 'bg-indigo-600/25 border-l-2 border-indigo-500 text-white' 
                            : 'hover:bg-canvas-card/50 text-content-primary'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-semibold truncate leading-snug">{p.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-content-secondary font-mono">
                            <span className="px-1.5 py-0.2 rounded bg-canvas-card text-content-secondary border border-canvas-hover/60 text-[9px]">{p.category}</span>
                            <span>{p.barcode || `#${p.id}`}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-indigo-300">Rs. {p.price.toFixed(2)}</div>
                          <div className={`text-[10px] font-medium font-mono ${p.stock <= 5 ? 'text-status-amber' : 'text-status-emerald'}`}>
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

          {/* Notifications are rendered by ToastHost (mounted at the App root). */}

          <Cart cart={cart} onUpdateQty={updateQty} onRemoveItem={removeItem} />
        </div>

        {/* Right side: Checkout Summary Panel */}
        <div className="w-[380px] flex flex-col enterprise-card rounded-xl overflow-hidden relative z-20 border-canvas-card">
          <header className="p-4 border-b border-canvas-card bg-canvas-subtle/80 backdrop-blur-md">
            <h2 className="text-sm font-bold flex items-center gap-2 text-white">
              <ShoppingCart size={16} className="text-indigo-400" /> Checkout Summary
            </h2>
          </header>

          <OrderControls 
            onHold={handleHold} 
            onResume={handleResume} 
            onClear={() => setClearOrderConfirmOpen(true)} 
            isOrderHeld={heldCart !== null} 
            cartIsEmpty={cart.length === 0} 
          />

          {/* Quick Discount Selector */}
          {cart.length > 0 && (
            <div className="px-4 py-2.5 border-t border-canvas-card bg-canvas/40 flex-shrink-0">
              <span className="text-[10px] text-content-secondary font-semibold uppercase tracking-wider block mb-1.5">{t('Quick Promo / Discount')}</span>
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
                        posActions.setDiscountMajor(calculatedVal);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium whitespace-nowrap border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-canvas-card/80 border-canvas-hover text-content-secondary hover:text-white hover:border-canvas-hover'
                      }`}
                    >
                      {promo.label}
                    </button>
                  );
                })}
                {discount > 0 && (
                  <button
                    onClick={() => posActions.setDiscountMajor(0)}
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap bg-status-coral/10 border border-status-coral/20 text-status-coral hover:bg-status-coral/20 transition-all cursor-pointer"
                  >
                    {t('Clear')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-5 border-t border-canvas-card bg-canvas/70 flex-1 flex flex-col justify-end">
            <div className="space-y-2.5 mb-5 relative z-10">
              <div className="flex justify-between items-center text-xs text-content-secondary font-medium">
                <span>{t('Line Items')}</span>
                <span className="text-content-primary font-mono">{totalItems}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-content-secondary font-medium">
                <span>{t('Subtotal')}</span>
                <span className="text-content-primary font-mono tabular-nums">Rs. {subtotal.toFixed(2)}</span>
              </div>
              {activeDiscount > 0 && (
                <div className="flex justify-between items-center text-xs text-status-amber font-medium">
                  <span>{t('Promo Discount')}</span>
                  <span className="font-mono tabular-nums">-Rs. {activeDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-canvas-card">
                <div>
                  <span className="text-xs uppercase tracking-wider text-content-secondary font-bold block">{t('Amount Due')}</span>
                  <span className="text-[10px] text-content-muted font-mono">Tax Incl.</span>
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
              className="w-full py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-canvas-card disabled:text-content-muted transition-all flex justify-center items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
            >
              <Printer size={18} />
              <span className="tracking-wide text-xs uppercase font-bold">{t('CHECKOUT (F1 / Space)')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cashier POS Keyboard Shortcuts Bar */}
      <div className="flex items-center justify-center gap-6 text-[11px] font-medium text-content-secondary bg-canvas-subtle/80 border border-canvas-card py-1.5 px-4 rounded-lg self-center">
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">F1</kbd> or <kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">Space</kbd> Pay</span>
        <span className="text-status-slate">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">F2</kbd> Hold/Resume</span>
        <span className="text-status-slate">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">F3</kbd> Custom Item</span>
        <span className="text-status-slate">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">F4</kbd> Catalog</span>
        <span className="text-status-slate">•</span>
        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-canvas-card text-content-primary rounded font-mono border border-canvas-hover text-[10px]">Esc</kbd> Void / Close</span>
      </div>
      
      {/* Navigation Bar at Bottom */}
      {renderNavbar()}

      {/* Payment Modal Overlay */}
      {isPaymentOpen && (
        <PaymentModal
          subtotal={totals.subtotal}
          tax={totals.tax}
          discount={fromMinor(discountMinor)}
          total={totals.total}
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
        existingCategories={existingCategories}
      />

      {/* Quick Add Modal on Scanning Unregistered Barcode */}
      {isQuickAddOpen && (
        <ProductFormModal
          product={scannedNewProduct}
          existingCategories={existingCategories}
          onClose={() => {
            setIsQuickAddOpen(false);
            setScannedNewProduct(null);
          }}
          onSave={handleSaveQuickProduct}
        />
      )}
      <ConfirmDialog
        open={clearOrderConfirmOpen}
        onClose={() => setClearOrderConfirmOpen(false)}
        onConfirm={handleClear}
        title="Void order"
        message="Are you sure you want to void this order?"
        confirmLabel="Void order"
      />
    </div>
  );
};

/** App wrapped in the device-locked licensing gate (trial / activation / revocation). */
const App: React.FC = () => (
  <LicenseGate>
    <AppContent />
    <ToastHost />
  </LicenseGate>
);

export default App;
