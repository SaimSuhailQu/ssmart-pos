import React, { useState, useEffect } from 'react';
import { Vendor, PurchaseOrder, Product, VendorPayment, VendorOrderEntry } from '../types';
import { Search, Plus, Edit2, Trash2, Truck, FileText, CheckCircle, Calendar, DollarSign, Package, ArrowLeft, PlusCircle, CreditCard, History, Clock, FileSpreadsheet, Eye, ChevronRight, Send } from 'lucide-react';

export const VendorManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'VENDORS' | 'POS' | 'PAYMENTS' | 'ORDERS'>('VENDORS');
  
  // Vendors State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  
  // Vendor Form Fields
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorCategory, setVendorCategory] = useState('');

  // Purchase Orders State
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  
  // PO Form Fields
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [poItems, setPoItems] = useState<{ productId: number; name: string; barcode: string; qty: number; costPrice: number }[]>([]);
  const [customTotalCost, setCustomTotalCost] = useState<string>('');
  const [poNotes, setPoNotes] = useState<string>('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemCostPrice, setItemCostPrice] = useState<number>(0);

  // Partial Payment & Order Entries History
  const [paymentHistory, setPaymentHistory] = useState<VendorPayment[]>([]);
  const [orderEntriesHistory, setOrderEntriesHistory] = useState<VendorOrderEntry[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<PurchaseOrder | null>(null);
  const [selectedPOForDetails, setSelectedPOForDetails] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payNotes, setPayNotes] = useState<string>('');

  // Status/Error notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadVendors = async () => {
    try {
      const data = await window.api.getAllVendors();
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const data = await window.api.getAllPurchaseOrders();
      setPurchaseOrders(data);
    } catch (err) {
      console.error('Failed to load POs:', err);
    }
  };

  const loadCatalogProducts = async () => {
    try {
      const data = await window.api.getAllProducts();
      setCatalogProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadPayments = async () => {
    try {
      const data = await window.api.getVendorPayments();
      setPaymentHistory(data);
    } catch (err) {
      console.error('Failed to load payment history:', err);
    }
  };

  const loadOrderEntries = async () => {
    try {
      const data = await window.api.getVendorOrderEntries();
      setOrderEntriesHistory(data);
    } catch (err) {
      console.error('Failed to load order history:', err);
    }
  };

  useEffect(() => {
    loadVendors();
    loadPurchaseOrders();
    loadCatalogProducts();
    loadPayments();
    loadOrderEntries();
  }, []);

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

  const handleOpenPaymentModal = (po: PurchaseOrder) => {
    setSelectedPOForPayment(po);
    const remaining = Math.max(0, po.total_cost - (po.paid_amount || 0));
    setPayAmount(remaining > 0 ? remaining.toString() : '');
    setPayMethod('Cash');
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForPayment) return;

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    try {
      await window.api.addVendorPayment({
        poId: selectedPOForPayment.id,
        vendorId: selectedPOForPayment.vendor_id,
        amount,
        paymentMethod: payMethod,
        notes: payNotes.trim()
      });

      setSuccess(`Recorded payment of Rs. ${amount.toLocaleString()} for PO #${selectedPOForPayment.id}`);
      setIsPaymentModalOpen(false);
      await loadPurchaseOrders();
      await loadPayments();
    } catch (err: any) {
      setError(err.message || 'Failed to record vendor payment.');
    }
  };

  // Vendor handlers
  const handleOpenAddVendor = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorContact('');
    setVendorCategory('');
    setIsVendorModalOpen(true);
  };

  const handleOpenEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorName(vendor.name);
    setVendorContact(vendor.contact || '');
    setVendorCategory(vendor.category || '');
    setIsVendorModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendor) {
        await window.api.updateVendor(editingVendor.id, { name: vendorName, contact: vendorContact, category: vendorCategory });
        setSuccess('Vendor updated successfully.');
      } else {
        await window.api.addVendor({ name: vendorName, contact: vendorContact, category: vendorCategory });
        setSuccess('Vendor added successfully.');
      }
      setIsVendorModalOpen(false);
      loadVendors();
    } catch (err) {
      setError('Failed to save vendor.');
      console.error(err);
    }
  };

  const handleDeleteVendor = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await window.api.deleteVendor(id);
        setSuccess('Vendor deleted.');
        loadVendors();
      } catch (err) {
        setError('Failed to delete vendor. It might be referenced by purchase orders.');
      }
    }
  };

  // Purchase Order handlers
  const handleStartCreatePO = () => {
    if (vendors.length === 0) {
      setError('Please add at least one vendor first!');
      return;
    }
    setSelectedVendorId(vendors[0].id);
    setPoItems([]);
    setCustomTotalCost('');
    setPoNotes('');
    setSelectedProductToAdd(null);
    setIsCreatingPO(true);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductToAdd(product);
    setItemCostPrice(product.cost_price);
    setItemQty(10); // default restock size
  };

  const handleAddProductToPO = () => {
    if (!selectedProductToAdd) return;
    
    // Check if product already added
    const existing = poItems.find(item => item.productId === selectedProductToAdd.id);
    if (existing) {
      setPoItems(prev => prev.map(item => 
        item.productId === selectedProductToAdd.id 
          ? { ...item, qty: item.qty + itemQty }
          : item
      ));
    } else {
      setPoItems(prev => [...prev, {
        productId: selectedProductToAdd.id,
        name: selectedProductToAdd.name,
        barcode: selectedProductToAdd.barcode,
        qty: itemQty,
        costPrice: itemCostPrice
      }]);
    }

    setSelectedProductToAdd(null);
    setProductSearch('');
    setSuccess(`Added ${selectedProductToAdd.name} to the PO list.`);
  };

  const handleRemovePOItem = (productId: number) => {
    setPoItems(prev => prev.filter(item => item.productId !== productId));
  };

  const calculateItemsSubtotal = () => {
    return poItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0);
  };

  const getEffectivePOTotal = () => {
    const rawCustom = customTotalCost.trim();
    if (rawCustom !== '') {
      const parsed = parseFloat(rawCustom);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return calculateItemsSubtotal();
  };

  const handleSavePO = async () => {
    if (!selectedVendorId) {
      setError('Please select a vendor.');
      return;
    }

    const finalCost = getEffectivePOTotal();

    if (poItems.length === 0 && finalCost <= 0) {
      setError('Please enter a Total Order Amount (Rs.) or add products to this purchase order.');
      return;
    }

    try {
      const itemsPayload = poItems.map(item => ({
        productId: item.productId,
        qty: item.qty,
        costPrice: item.costPrice
      }));

      await window.api.createPurchaseOrder(
        Number(selectedVendorId), 
        itemsPayload, 
        finalCost, 
        poNotes.trim()
      );
      setSuccess(`Purchase order for Rs. ${finalCost.toLocaleString()} saved successfully.`);
      setIsCreatingPO(false);
      await loadPurchaseOrders();
      await loadCatalogProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to create purchase order.');
      console.error(err);
    }
  };

  const handleReceivePO = async (poId: number) => {
    if (window.confirm('Receive shipment for this Purchase Order? This will automatically add items to your active inventory stock!')) {
      try {
        await window.api.receivePurchaseOrder(poId);
        setSuccess('Purchase order marked as RECEIVED. Inventory stock levels updated!');
        loadPurchaseOrders();
        loadCatalogProducts();
      } catch (err: any) {
        setError(err.message || 'Failed to receive purchase order.');
      }
    }
  };

  const handleDeletePO = async (poId: number) => {
    if (window.confirm('Are you sure you want to delete this purchase order record? All associated payment ledgers and order entries will also be removed.')) {
      try {
        await window.api.deletePurchaseOrder(poId);
        setSuccess('Purchase order and associated ledger history deleted.');
        await loadPurchaseOrders();
        await loadPayments();
        await loadOrderEntries();
      } catch (err: any) {
        setError(err.message || 'Failed to delete purchase order.');
      }
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCatalog = catalogProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode.includes(productSearch)
  );

  const calculateTotalCost = () => {
    return poItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0);
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255, 255, 255, 0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* Alerts Block */}
        {(error || success) && (
          <div className="mb-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md flex items-center gap-2 animate-in zoom-in-95">
                <span>⚠️</span> <div>{error}</div>
              </div>
            )}
            {success && (
              <div className="p-3 bg-white/10 border border-emerald-500/20 text-neutral-200 rounded-xl text-sm backdrop-blur-md flex items-center gap-2 animate-in zoom-in-95">
                <CheckCircle size={16} /> <div>{success}</div>
              </div>
            )}
          </div>
        )}

        {/* View Mode: Create PO Sub-View */}
        {isCreatingPO ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsCreatingPO(false)}
                  className="p-2.5 text-gray-400 hover:text-white glass-button rounded-xl transition"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    <FileText className="text-neutral-200" size={24} /> Create Purchase Order
                  </h2>
                  <p className="text-xs text-gray-400">Order wholesale inventory restocks.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCreatingPO(false)}
                  className="px-5 py-2.5 glass-button rounded-xl font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePO}
                  className="px-6 py-2.5 bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-white hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] transition cursor-pointer active:scale-95"
                >
                  Save Purchase Order
                </button>
              </div>
            </div>

            {/* Content Split */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
              
              {/* Left Side: Setup & Items (8 Columns) */}
              <div className="lg:col-span-8 flex flex-col glass-panel p-6 rounded-2xl border-white/5 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 flex-shrink-0">
                  <div>
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-widest block mb-1.5">1. Select Vendor *</label>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 glass-input rounded-xl font-bold text-white text-sm bg-neutral-900"
                    >
                      {vendors.map(v => (
                        <option key={v.id} value={v.id} className="bg-neutral-900 text-white font-bold">{v.name} ({v.category})</option>
                      ))}
                    </select>
                    {(() => {
                      const vendorPO = purchaseOrders.find(p => p.vendor_id === selectedVendorId);
                      if (vendorPO) {
                        const remaining = Math.max(0, vendorPO.total_cost - (vendorPO.paid_amount || 0));
                        return (
                          <span className="text-[10px] text-emerald-400 font-bold mt-1 block">
                            Active Bill: Rs. {vendorPO.total_cost.toLocaleString()} • Due: Rs. {remaining.toLocaleString()} (Auto-sums)
                          </span>
                        );
                      }
                      return <span className="text-[10px] text-gray-500 mt-1 block">New supplier order account</span>;
                    })()}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1.5">2. Add Order Amount (Rs.)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={poItems.length > 0 ? `Subtotal: ${calculateItemsSubtotal()}` : "Enter Order Invoice Rs..."}
                      value={customTotalCost}
                      onChange={(e) => setCustomTotalCost(e.target.value)}
                      className="w-full px-4 py-3 glass-input rounded-xl font-bold text-emerald-400 text-sm placeholder:text-gray-600 border-emerald-500/30 focus:border-emerald-400"
                    />
                    <span className="text-[10px] text-gray-500 mt-1 block">Adds to this vendor's single running balance.</span>
                  </div>

                  <div className="flex flex-col justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Added Bill Amount</span>
                    <span className="text-2xl font-extrabold text-emerald-400">
                      Rs. {getEffectivePOTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="mb-4 flex-shrink-0">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Invoice Notes / Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mixed confectionery batch, invoice #8841, cash on delivery..."
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl text-gray-200 placeholder:text-gray-600"
                  />
                </div>

                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest block mb-2 flex-shrink-0">3. Optional: Specific Line Items ({poItems.length})</span>
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
                  {poItems.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-gray-500 py-12">
                      <Package size={48} className="text-white/10 mb-2" />
                      <p className="font-bold text-sm">No items added to this PO cart.</p>
                      <p className="text-xs mt-1 text-gray-600">Select items from the catalog search on the right.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] tracking-wider uppercase">
                          <th className="py-2.5">Product</th>
                          <th className="py-2.5 text-center">Cost Price</th>
                          <th className="py-2.5 text-center">Quantity</th>
                          <th className="py-2.5 text-right">Total (PKR)</th>
                          <th className="py-2.5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {poItems.map(item => (
                          <tr key={item.productId} className="hover:bg-white/5 transition-colors group">
                            <td className="py-3">
                              <div className="font-extrabold text-white text-sm">{item.name}</div>
                              <div className="text-[10px] text-neutral-200/70">{item.barcode}</div>
                            </td>
                            <td className="py-3 text-center">
                              <input 
                                type="number" 
                                value={item.costPrice} 
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setPoItems(prev => prev.map(p => p.productId === item.productId ? { ...p, costPrice: val } : p));
                                }}
                                className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-center text-neutral-200 font-bold text-xs focus:outline-none focus:border-white/60"
                              />
                            </td>
                            <td className="py-3 text-center">
                              <input 
                                type="number" 
                                value={item.qty} 
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setPoItems(prev => prev.map(p => p.productId === item.productId ? { ...p, qty: val } : p));
                                }}
                                className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-center text-white font-bold text-xs focus:outline-none focus:border-white/60"
                              />
                            </td>
                            <td className="py-3 text-right font-bold text-white text-xs">
                              Rs. {(item.qty * item.costPrice).toLocaleString()}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleRemovePOItem(item.productId)}
                                className="text-red-400 hover:text-red-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Side: Product Catalog Search (4 Columns) */}
              <div className="lg:col-span-4 flex flex-col glass-panel p-5 rounded-2xl border-white/5 overflow-hidden">
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-widest block mb-2 flex-shrink-0">Catalog Product Search</span>
                <div className="relative mb-3 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search by name or barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs glass-input rounded-xl"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-200" size={14} />
                </div>

                {/* Search list */}
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 divide-y divide-white/5 mb-3">
                  {filteredCatalog.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition flex justify-between items-center ${selectedProductToAdd?.id === p.id ? 'bg-white/10 border border-white/30' : 'border border-transparent'}`}
                    >
                      <div>
                        <div className="font-extrabold text-xs text-white">{p.name}</div>
                        <div className="text-[9px] text-gray-500 mt-0.5">Code: {p.barcode} • Stock: {p.stock}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-neutral-200">Rs. {p.price}</div>
                        <div className="text-[9px] text-gray-500">Cost: Rs. {p.cost_price}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Configuration Overlay for adding to PO */}
                {selectedProductToAdd && (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex-shrink-0 animate-in zoom-in-95">
                    <div className="text-xs font-extrabold text-white mb-2 truncate">Add "{selectedProductToAdd.name}"</div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Unit Cost</label>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={itemCostPrice}
                          onChange={e => setItemCostPrice(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-black/25 border border-white/10 rounded font-bold text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Quantity</label>
                        <input 
                          type="number" 
                          min="1"
                          value={itemQty}
                          onChange={e => {
                            const q = Math.max(1, Number(e.target.value) || 1);
                            setItemQty(q);
                          }}
                          className="w-full px-2 py-1.5 bg-black/25 border border-white/10 rounded font-bold text-xs text-white focus:outline-none focus:border-white/50"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Total Cost (Rs.)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={Number((itemCostPrice * itemQty).toFixed(2))}
                          onChange={e => {
                            const totalVal = Number(e.target.value);
                            if (itemQty > 0) {
                              setItemCostPrice(Number((totalVal / itemQty).toFixed(2)));
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-black/25 border border-white/10 rounded font-bold text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleAddProductToPO}
                      className="w-full py-2 bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-white hover:to-emerald-500 text-black font-extrabold rounded-lg text-xs tracking-wider uppercase transition shadow-md flex justify-center items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <PlusCircle size={14} /> Add to Order (Rs. {(itemCostPrice * itemQty).toLocaleString()})
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          // Default Dashboard View
          <div className="flex flex-col h-full">
            
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <Truck className="text-neutral-200 drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.4)]" size={32} />
                  Vendors & Purchase Orders
                </h2>
                <p className="text-gray-400 mt-1">Manage wholesale suppliers, purchase order invoices, and restock inventory.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleOpenAddVendor}
                  className="px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition flex items-center gap-2"
                >
                  <Plus size={18} /> Add Vendor
                </button>
                <button
                  onClick={handleStartCreatePO}
                  className="px-5 py-3 bg-gradient-to-r from-neutral-200 to-neutral-400 hover:from-neutral-200 hover:to-neutral-400 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-[0_0_20px_rgba(255, 255, 255, 0.3)]"
                >
                  <FileText size={18} /> Create PO
                </button>
              </div>
            </div>

            {/* Sub Tabs Panel */}
            <div className="flex border-b border-white/5 mb-6">
              <button
                onClick={() => setActiveTab('VENDORS')}
                className={`pb-3 px-6 font-bold text-sm tracking-wider uppercase border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'VENDORS' 
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Truck size={16} /> Wholesale Vendors ({vendors.length})
              </button>
              <button
                onClick={() => setActiveTab('POS')}
                className={`pb-3 px-6 font-bold text-sm tracking-wider uppercase border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'POS' 
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <FileText size={16} /> Purchase Orders ({purchaseOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('PAYMENTS')}
                className={`pb-3 px-6 font-bold text-sm tracking-wider uppercase border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'PAYMENTS' 
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <History size={16} /> Payment Ledger ({paymentHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('ORDERS')}
                className={`pb-3 px-6 font-bold text-sm tracking-wider uppercase border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'ORDERS' 
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <FileSpreadsheet size={16} /> Order Entries ({orderEntriesHistory.length})
              </button>
            </div>

            {/* Tab Body: Vendors */}
            {activeTab === 'VENDORS' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
                {/* Search Bar */}
                <div className="relative mb-5 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search vendors by name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-200" size={20} />
                </div>

                {/* Vendors Table */}
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {filteredVendors.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-gray-500 py-16">
                      <Truck size={64} className="text-white/10 mb-3" />
                      <p className="font-bold">No suppliers registered.</p>
                      <p className="text-xs text-gray-600 mt-1">Click "Add Vendor" above to register wholesale companies.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral-200 font-bold text-sm tracking-wider uppercase">
                          <th className="py-4 px-4">Vendor Company</th>
                          <th className="py-4 px-4">Wholesale Category</th>
                          <th className="py-4 px-4">Contact & Support</th>
                          <th className="py-4 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredVendors.map(v => (
                          <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                            <td className="py-4 px-4">
                              <div className="font-extrabold text-white">{v.name}</div>
                              <div className="text-xs text-neutral-200/70">ID: #{v.id}</div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-3 py-1 bg-white/10 border border-white/25 text-neutral-200 rounded-full font-bold text-xs">
                                {v.category || 'General'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-gray-300 text-sm font-semibold">{v.contact || 'No contact registered'}</span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenEditVendor(v)}
                                  className="p-2 text-neutral-200 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteVendor(v.id)}
                                  className="p-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Tab Body: Purchase Orders */}
            {activeTab === 'POS' && (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin animate-in fade-in duration-200">
                {purchaseOrders.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-gray-500 py-20">
                    <FileText size={64} className="text-white/10 mb-3" />
                    <p className="font-bold">No purchase orders created.</p>
                    <p className="text-xs text-gray-600 mt-1">Click "Create PO" to log restocking orders from suppliers.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    {purchaseOrders.map(po => {
                      const paid = po.paid_amount || 0;
                      const remaining = Math.max(0, po.total_cost - paid);
                      const isPaid = paid >= po.total_cost && po.total_cost > 0;
                      const isPartial = paid > 0 && paid < po.total_cost;

                      return (
                        <div key={po.id} className="glass-panel p-5 rounded-2xl border-white/5 hover:border-white/10 flex flex-col relative overflow-hidden group">
                          
                          {/* PO Status Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">Order ID: #{po.id}</div>
                              <h3 className="font-extrabold text-white text-lg mt-0.5">{po.vendor_name}</h3>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Stock Delivery Status */}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                po.status === 'Received'
                                  ? 'bg-white/10 text-emerald-400 border-emerald-500/30'
                                  : po.status === 'Cancelled'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 animate-pulse'
                              }`}>
                                {po.status}
                              </span>

                              {/* Payment Status Pill */}
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                isPaid 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : isPartial
                                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              }`}>
                                {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                              </span>

                              <button
                                onClick={() => handleDeletePO(po.id)}
                                className="p-1 text-gray-500 hover:text-red-400 rounded-lg transition-colors hover:bg-white/5 ml-1"
                                title="Delete Purchase Order"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Financials & Balance Box */}
                          <div className="p-3.5 bg-black/40 rounded-xl border border-white/5 mb-3">
                            <div className="flex justify-between items-center mb-1.5 text-xs">
                              <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Total Bill:</span>
                              <span className="font-extrabold text-white">Rs. {po.total_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center mb-1.5 text-xs">
                              <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Paid Amount:</span>
                              <span className="font-extrabold text-emerald-400">Rs. {paid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-white/5 text-xs">
                              <span className="text-gray-300 font-bold uppercase text-[10px] tracking-wider">Remaining Balance:</span>
                              <span className={`font-black ${remaining > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                Rs. {remaining.toLocaleString()}
                              </span>
                            </div>

                            {/* Progress bar */}
                            {po.total_cost > 0 && (
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2.5">
                                <div 
                                  className={`h-full ${isPaid ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-cyan-400'}`}
                                  style={{ width: `${Math.min(100, (paid / po.total_cost) * 100)}%` }}
                                ></div>
                              </div>
                            )}
                          </div>

                          {/* List items briefly or show order notes */}
                          {po.notes && (
                            <div className="mb-3 px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-[11px] text-gray-300 italic">
                              "{po.notes}"
                            </div>
                          )}

                          {po.items && po.items.length > 0 ? (
                            <div className="mb-4 text-[11px] text-gray-400 max-h-20 overflow-y-auto space-y-1 scrollbar-none pr-1">
                              {po.items.map(item => (
                                <div key={item.id} className="flex justify-between border-b border-white/5 pb-1">
                                  <span className="truncate pr-2">{item.product_name}</span>
                                  <span className="font-bold text-gray-300">x{item.qty}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mb-4 text-[11px] text-gray-500 italic">
                              Lump-sum vendor order (no line item tracking).
                            </div>
                          )}

                          {/* Actions: Pay, Receive & View Statement */}
                          <div className="mt-auto pt-2 flex flex-col gap-2">
                            <div className="flex gap-2">
                              {remaining > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(po)}
                                  className="flex-1 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs tracking-wider uppercase transition flex justify-center items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.1)] cursor-pointer active:scale-95"
                                >
                                  <CreditCard size={14} /> Pay Vendor
                                </button>
                              )}

                              {po.status === 'Pending' && (
                                <button
                                  onClick={() => handleReceivePO(po.id)}
                                  className="flex-1 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-xl font-bold text-xs tracking-wider uppercase transition flex justify-center items-center gap-1.5 shadow-[0_0_12px_rgba(234,179,8,0.1)] cursor-pointer active:scale-95"
                                >
                                  <CheckCircle size={14} /> Receive Stock
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => setSelectedPOForDetails(po)}
                              className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl font-bold text-xs tracking-wider uppercase transition flex justify-center items-center gap-1.5 cursor-pointer"
                            >
                              <Eye size={13} /> View Complete Vendor Statement
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab Body: Payment History Ledger */}
            {activeTab === 'PAYMENTS' && (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin animate-in fade-in duration-200">
                {paymentHistory.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-gray-500 py-20">
                    <History size={64} className="text-white/10 mb-3" />
                    <p className="font-bold">No vendor payments recorded yet.</p>
                    <p className="text-xs text-gray-600 mt-1">Make full or partial payments on purchase orders to view the transaction audit ledger.</p>
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 font-bold text-xs tracking-wider uppercase bg-white/5">
                          <th className="py-4 px-5">Date & Time</th>
                          <th className="py-4 px-4">Vendor</th>
                          <th className="py-4 px-4">PO Ref</th>
                          <th className="py-4 px-4">Payment Method</th>
                          <th className="py-4 px-4">Notes</th>
                          <th className="py-4 px-5 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        {paymentHistory.map(pay => (
                          <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-5 text-xs text-gray-400 flex items-center gap-1.5">
                              <Clock size={13} className="text-gray-500" />
                              {new Date(pay.timestamp).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 font-bold text-white">
                              {pay.vendor_name}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono font-bold text-cyan-300">
                                #{pay.po_id}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-xs font-bold text-gray-300">
                                <CreditCard size={12} /> {pay.payment_method}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-gray-400 italic">
                              {pay.notes || '—'}
                            </td>
                            <td className="py-4 px-5 text-right font-extrabold text-emerald-400 text-base">
                              Rs. {pay.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab Body: Order Entries Ledger */}
            {activeTab === 'ORDERS' && (
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin animate-in fade-in duration-200">
                {orderEntriesHistory.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-gray-500 py-20">
                    <FileSpreadsheet size={64} className="text-white/10 mb-3" />
                    <p className="font-bold">No individual order entries recorded yet.</p>
                    <p className="text-xs text-gray-600 mt-1">Every time you create or add to a vendor's purchase order, the itemized invoice entry is logged here.</p>
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-400 font-bold text-xs tracking-wider uppercase bg-white/5">
                          <th className="py-4 px-5">Order Date & Time</th>
                          <th className="py-4 px-4">Vendor</th>
                          <th className="py-4 px-4">PO Ref</th>
                          <th className="py-4 px-4">Order Notes / Invoice Ref</th>
                          <th className="py-4 px-5 text-right">Order Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        {orderEntriesHistory.map(entry => (
                          <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-5 text-xs text-gray-400 flex items-center gap-1.5">
                              <Calendar size={13} className="text-gray-500" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 font-bold text-white">
                              {entry.vendor_name}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono font-bold text-cyan-300">
                                #{entry.po_id}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-gray-300">
                              {entry.notes || 'Lump-sum stock delivery'}
                            </td>
                            <td className="py-4 px-5 text-right font-extrabold text-white text-base">
                              Rs. {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Modal: Vendor Add / Edit */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-md p-6 md:p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2.5">
              <Truck className="text-emerald-400" />
              {editingVendor ? 'Edit Vendor Profile' : 'Register New Vendor'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveVendor} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. National Foods Ltd"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">Wholesale Category *</label>
                <input
                  type="text"
                  required
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. Groceries, Drinks, Snacks, Dairy"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">Contact Phone / Email (Optional)</label>
                <input
                  type="text"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. 0300-1234567 or sales@vendor.com"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="px-5 py-2.5 glass-button rounded-xl font-bold text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-white hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-lg cursor-pointer active:scale-95"
                >
                  {editingVendor ? 'Save Changes' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pay Vendor (Partial / Full Payment) */}
      {isPaymentModalOpen && selectedPOForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-md p-6 md:p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
              <CreditCard className="text-emerald-400" />
              Pay Vendor
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Record full or partial payment for <strong className="text-white">{selectedPOForPayment.vendor_name}</strong> (PO #{selectedPOForPayment.id}).
            </p>

            {/* Financial Status Summary */}
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 mb-5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Order Amount:</span>
                <span className="font-extrabold text-white">Rs. {selectedPOForPayment.total_cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Already Paid:</span>
                <span className="font-extrabold text-emerald-400">Rs. {(selectedPOForPayment.paid_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/5">
                <span className="text-gray-200 font-bold">Remaining Due Balance:</span>
                <span className="font-black text-orange-400 text-sm">
                  Rs. {Math.max(0, selectedPOForPayment.total_cost - (selectedPOForPayment.paid_amount || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1.5">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-emerald-400 font-bold text-base"
                  placeholder="Enter amount to pay..."
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white font-bold text-sm bg-neutral-900"
                >
                  <option value="Cash" className="bg-neutral-900 text-white">Cash</option>
                  <option value="Bank Transfer" className="bg-neutral-900 text-white">Bank Transfer / Online</option>
                  <option value="Cheque" className="bg-neutral-900 text-white">Cheque</option>
                  <option value="JazzCash / EasyPaisa" className="bg-neutral-900 text-white">JazzCash / EasyPaisa</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Payment Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                  placeholder="e.g. Paid in cash, cheque #5012..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-5 py-2.5 glass-button rounded-xl font-bold text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-neutral-200 to-emerald-600 hover:from-white hover:to-emerald-500 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-lg cursor-pointer active:scale-95"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Vendor Statement & Audit Drill-Down */}
      {selectedPOForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] p-6 md:p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-4 flex-shrink-0 pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">Complete Financial Statement</span>
                <h3 className="text-2xl font-extrabold text-white mt-0.5">{selectedPOForDetails.vendor_name}</h3>
                <span className="text-xs text-gray-400">Account ID: #{selectedPOForDetails.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const vendorObj = vendors.find(v => v.id === selectedPOForDetails.vendor_id);
                    let cleanContact = (vendorObj?.contact || '').replace(/[^0-9]/g, '');
                    if (cleanContact.startsWith('0')) {
                      cleanContact = '92' + cleanContact.slice(1);
                    } else if (cleanContact.length === 10) {
                      cleanContact = '92' + cleanContact;
                    }

                    const todayStr = new Date().toLocaleDateString('en-PK', { dateStyle: 'medium' });
                    const billed = selectedPOForDetails.total_cost || 0;
                    const paid = selectedPOForDetails.paid_amount || 0;
                    const balance = Math.max(0, billed - paid);

                    let message = `🏪 *SS MART & GENERAL STORE*\n`;
                    message += `📊 *OFFICIAL VENDOR ACCOUNT STATEMENT*\n`;
                    message += `──────────────────────\n`;
                    message += `🏢 *Vendor:* ${selectedPOForDetails.vendor_name}\n`;
                    message += `📱 *Contact:* ${vendorObj?.contact || 'N/A'}\n`;
                    message += `📅 *Date:* ${todayStr}\n`;
                    message += `──────────────────────\n`;
                    message += `📈 *Total Goods Billed:* Rs. ${billed.toLocaleString()}\n`;
                    message += `💳 *Total Amount Paid:* Rs. ${paid.toLocaleString()}\n`;
                    message += `🔴 *REMAINING BALANCE DUE:* Rs. ${balance.toLocaleString()}\n`;
                    message += `──────────────────────\n\n`;

                    if (selectedPOForDetails.order_entries && selectedPOForDetails.order_entries.length > 0) {
                      message += `📦 *Order Deliveries:*\n`;
                      selectedPOForDetails.order_entries.forEach((ord) => {
                        message += `• Entry #${ord.id}: Rs. ${ord.amount.toLocaleString()} (${new Date(ord.timestamp).toLocaleDateString()} - ${ord.notes || 'Restock'})\n`;
                      });
                      message += `\n`;
                    }

                    if (selectedPOForDetails.payments && selectedPOForDetails.payments.length > 0) {
                      message += `💰 *Payment Installments:*\n`;
                      selectedPOForDetails.payments.forEach((pay) => {
                        message += `• ${pay.payment_method}: Rs. ${pay.amount.toLocaleString()} (${new Date(pay.timestamp).toLocaleDateString()})\n`;
                      });
                      message += `\n`;
                    }

                    message += `──────────────────────\n`;
                    message += `🙏 *Thank you for your partnership with SS Mart!*`;

                    // Attempt direct silent Meta Cloud API send first
                    window.api.sendWhatsAppMessage(cleanContact, message).then((res) => {
                      if (res.success) {
                        alert(`✅ WhatsApp Statement sent silently & automatically to ${selectedPOForDetails.vendor_name}!`);
                      } else {
                        const encoded = encodeURIComponent(message);
                        const waUrl = cleanContact 
                          ? `https://wa.me/${cleanContact}?text=${encoded}`
                          : `https://wa.me/?text=${encoded}`;
                        window.open(waUrl, '_blank');
                      }
                    }).catch(() => {
                      const encoded = encodeURIComponent(message);
                      const waUrl = cleanContact 
                        ? `https://wa.me/${cleanContact}?text=${encoded}`
                        : `https://wa.me/?text=${encoded}`;
                      window.open(waUrl, '_blank');
                    });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition cursor-pointer active:scale-95"
                  title="Automate send complete ledger to Vendor on WhatsApp"
                >
                  <Send size={14} />
                  <span>WhatsApp Statement</span>
                </button>
                <button
                  onClick={() => setSelectedPOForDetails(null)}
                  className="p-2 text-gray-400 hover:text-white glass-button rounded-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Financial Status Summary */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5 mb-6 flex-shrink-0">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Total Billed</span>
                <span className="text-lg font-black text-white">Rs. {selectedPOForDetails.total_cost.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Total Paid</span>
                <span className="text-lg font-black text-emerald-400">Rs. {(selectedPOForDetails.paid_amount || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Balance Due</span>
                <span className={`text-lg font-black ${Math.max(0, selectedPOForDetails.total_cost - (selectedPOForDetails.paid_amount || 0)) > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  Rs. {Math.max(0, selectedPOForDetails.total_cost - (selectedPOForDetails.paid_amount || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Statement Split: Orders vs Payments */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin">
              
              {/* 1. All Order Invoice Entries & Line Items */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-cyan-400" />
                  Order / Invoice Deliveries ({selectedPOForDetails.order_entries?.length || (selectedPOForDetails.total_cost > 0 ? 1 : 0)})
                </h4>

                {selectedPOForDetails.order_entries && selectedPOForDetails.order_entries.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPOForDetails.order_entries.map((entry, idx) => (
                      <div key={entry.id || idx} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>Order Entry #{entry.id}</span>
                            <span className="text-[10px] text-gray-400">• {new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{entry.notes || 'Restock Order'}</div>
                        </div>
                        <span className="font-extrabold text-white text-sm">Rs. {entry.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>Initial Order #{selectedPOForDetails.id}</span>
                        <span className="text-[10px] text-gray-400">• {new Date(selectedPOForDetails.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{selectedPOForDetails.notes || 'Lump-sum stock order'}</div>
                    </div>
                    <span className="font-extrabold text-white text-sm">Rs. {selectedPOForDetails.total_cost.toLocaleString()}</span>
                  </div>
                )}

                {/* Show line items if any were catalogued */}
                {selectedPOForDetails.items && selectedPOForDetails.items.length > 0 && (
                  <div className="mt-3 p-3 bg-black/30 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Tracked Products ({selectedPOForDetails.items.length})</span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-none">
                      {selectedPOForDetails.items.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-300 border-b border-white/5 pb-1">
                          <span>{item.product_name}</span>
                          <span className="font-bold">x{item.qty} (Rs. {(item.qty * item.cost_price).toLocaleString()})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. All Payment Installments */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <CreditCard size={15} className="text-emerald-400" />
                  Payment Installments Recorded ({selectedPOForDetails.payments?.length || 0})
                </h4>

                {(!selectedPOForDetails.payments || selectedPOForDetails.payments.length === 0) ? (
                  <div className="p-4 bg-white/5 rounded-xl text-center text-xs text-gray-500 italic">
                    No payments logged yet for this vendor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedPOForDetails.payments.map((pay, idx) => (
                      <div key={pay.id || idx} className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="text-emerald-400">{pay.payment_method} Payment</span>
                            <span className="text-[10px] text-gray-400">• {new Date(pay.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{pay.notes || 'Payment installment'}</div>
                        </div>
                        <span className="font-extrabold text-emerald-400 text-sm">Rs. {pay.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-white/5 flex justify-between items-center flex-shrink-0 mt-4">
              <button
                onClick={() => {
                  const vendorObj = vendors.find(v => v.id === selectedPOForDetails.vendor_id);
                  let cleanContact = (vendorObj?.contact || '').replace(/[^0-9]/g, '');
                  if (cleanContact.startsWith('0')) {
                    cleanContact = '92' + cleanContact.slice(1);
                  } else if (cleanContact.length === 10) {
                    cleanContact = '92' + cleanContact;
                  }

                  const todayStr = new Date().toLocaleDateString('en-PK', { dateStyle: 'medium' });
                  const billed = selectedPOForDetails.total_cost || 0;
                  const paid = selectedPOForDetails.paid_amount || 0;
                  const balance = Math.max(0, billed - paid);

                  let message = `🏪 *SS MART & GENERAL STORE*\n`;
                  message += `📊 *OFFICIAL VENDOR ACCOUNT STATEMENT*\n`;
                  message += `──────────────────────\n`;
                  message += `🏢 *Vendor:* ${selectedPOForDetails.vendor_name}\n`;
                  message += `📱 *Contact:* ${vendorObj?.contact || 'N/A'}\n`;
                  message += `📅 *Date:* ${todayStr}\n`;
                  message += `──────────────────────\n`;
                  message += `📈 *Total Goods Billed:* Rs. ${billed.toLocaleString()}\n`;
                  message += `💳 *Total Amount Paid:* Rs. ${paid.toLocaleString()}\n`;
                  message += `🔴 *REMAINING BALANCE DUE:* Rs. ${balance.toLocaleString()}\n`;
                  message += `──────────────────────\n\n`;

                  if (selectedPOForDetails.order_entries && selectedPOForDetails.order_entries.length > 0) {
                    message += `📦 *Order Deliveries:*\n`;
                    selectedPOForDetails.order_entries.forEach((ord) => {
                      message += `• Entry #${ord.id}: Rs. ${ord.amount.toLocaleString()} (${new Date(ord.timestamp).toLocaleDateString()} - ${ord.notes || 'Restock'})\n`;
                    });
                    message += `\n`;
                  }

                  if (selectedPOForDetails.payments && selectedPOForDetails.payments.length > 0) {
                    message += `💰 *Payment Installments:*\n`;
                    selectedPOForDetails.payments.forEach((pay) => {
                      message += `• ${pay.payment_method}: Rs. ${pay.amount.toLocaleString()} (${new Date(pay.timestamp).toLocaleDateString()})\n`;
                    });
                    message += `\n`;
                  }

                  message += `──────────────────────\n`;
                  message += `🙏 *Thank you for your partnership with SS Mart!*`;

                  // Attempt direct silent Meta Cloud API send first
                  window.api.sendWhatsAppMessage(cleanContact, message).then((res) => {
                    if (res.success) {
                      alert(`✅ WhatsApp Statement sent silently & automatically to ${selectedPOForDetails.vendor_name}!`);
                    } else {
                      const encoded = encodeURIComponent(message);
                      const waUrl = cleanContact 
                        ? `https://wa.me/${cleanContact}?text=${encoded}`
                        : `https://wa.me/?text=${encoded}`;
                      window.open(waUrl, '_blank');
                    }
                  }).catch(() => {
                    const encoded = encodeURIComponent(message);
                    const waUrl = cleanContact 
                      ? `https://wa.me/${cleanContact}?text=${encoded}`
                      : `https://wa.me/?text=${encoded}`;
                    window.open(waUrl, '_blank');
                  });
                }}
                className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send size={13} /> Send Ledger to Vendor on WhatsApp
              </button>
              <button
                onClick={() => setSelectedPOForDetails(null)}
                className="px-6 py-2.5 glass-button rounded-xl font-bold text-xs text-white cursor-pointer"
              >
                Close Statement
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
