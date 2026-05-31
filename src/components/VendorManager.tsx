import React, { useState, useEffect } from 'react';
import { Vendor, PurchaseOrder, Product } from '../types';
import { Search, Plus, Edit2, Trash2, Truck, FileText, CheckCircle, Calendar, DollarSign, Package, ArrowLeft, PlusCircle } from 'lucide-react';

export const VendorManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'VENDORS' | 'POS'>('VENDORS');
  
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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemCostPrice, setItemCostPrice] = useState<number>(0);

  // Status/Error notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
    loadPurchaseOrders();
    loadCatalogProducts();
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

  const handleSavePO = async () => {
    if (!selectedVendorId) {
      setError('Please select a vendor.');
      return;
    }
    if (poItems.length === 0) {
      setError('Please add at least one product to the purchase order.');
      return;
    }

    try {
      const itemsPayload = poItems.map(item => ({
        productId: item.productId,
        qty: item.qty,
        costPrice: item.costPrice
      }));
      await window.api.createPurchaseOrder(Number(selectedVendorId), itemsPayload);
      setSuccess('Purchase order created successfully.');
      setIsCreatingPO(false);
      loadPurchaseOrders();
      loadCatalogProducts(); // update lists if stock changed (though this is Pending)
    } catch (err) {
      setError('Failed to create purchase order.');
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
    <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full">
        
        {/* Alerts Block */}
        {(error || success) && (
          <div className="mb-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm backdrop-blur-md flex items-center gap-2 animate-in zoom-in-95">
                <span>⚠️</span> <div>{error}</div>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm backdrop-blur-md flex items-center gap-2 animate-in zoom-in-95">
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
                    <FileText className="text-cyan-400" size={24} /> Create Purchase Order
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
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition"
                >
                  Save Purchase Order
                </button>
              </div>
            </div>

            {/* Content Split */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
              
              {/* Left Side: Setup & Items (8 Columns) */}
              <div className="lg:col-span-8 flex flex-col glass-panel p-6 rounded-2xl border-white/5 overflow-hidden">
                <div className="grid grid-cols-2 gap-4 mb-5 flex-shrink-0">
                  <div>
                    <label className="text-xs font-bold text-cyan-300 uppercase tracking-widest block mb-1.5">1. Select Vendor</label>
                    <select
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 glass-input rounded-xl font-bold text-white text-sm"
                    >
                      {vendors.map(v => (
                        <option key={v.id} value={v.id} className="bg-slate-900 text-white font-bold">{v.name} ({v.category})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end items-end p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Estimated Subtotal</span>
                    <span className="text-2xl font-extrabold text-cyan-400">Rs. {calculateTotalCost().toLocaleString()}</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest block mb-2 flex-shrink-0">2. PO Order Items</span>
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
                              <div className="text-[10px] text-cyan-400/70">{item.barcode}</div>
                            </td>
                            <td className="py-3 text-center">
                              <input 
                                type="number" 
                                value={item.costPrice} 
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setPoItems(prev => prev.map(p => p.productId === item.productId ? { ...p, costPrice: val } : p));
                                }}
                                className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-center text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-400"
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
                                className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-center text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
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
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest block mb-2 flex-shrink-0">Catalog Product Search</span>
                <div className="relative mb-3 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search by name or barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs glass-input rounded-xl"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={14} />
                </div>

                {/* Search list */}
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 divide-y divide-white/5 mb-3">
                  {filteredCatalog.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition flex justify-between items-center ${selectedProductToAdd?.id === p.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'border border-transparent'}`}
                    >
                      <div>
                        <div className="font-extrabold text-xs text-white">{p.name}</div>
                        <div className="text-[9px] text-gray-500 mt-0.5">Code: {p.barcode} • Stock: {p.stock}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-cyan-400">Rs. {p.price}</div>
                        <div className="text-[9px] text-gray-500">Cost: Rs. {p.cost_price}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Configuration Overlay for adding to PO */}
                {selectedProductToAdd && (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex-shrink-0 animate-in zoom-in-95">
                    <div className="text-xs font-extrabold text-white mb-2 truncate">Add "{selectedProductToAdd.name}"</div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Restock Cost</label>
                        <input 
                          type="number" 
                          value={itemCostPrice}
                          onChange={e => setItemCostPrice(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-black/25 border border-white/10 rounded font-bold text-xs text-cyan-300 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Quantity</label>
                        <input 
                          type="number" 
                          value={itemQty}
                          onChange={e => setItemQty(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-black/25 border border-white/10 rounded font-bold text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleAddProductToPO}
                      className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold rounded-lg text-xs tracking-wider uppercase transition shadow-md flex justify-center items-center gap-1"
                    >
                      <PlusCircle size={14} /> Add to Order
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
                  <Truck className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" size={32} />
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
                  className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
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
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Truck size={16} /> Wholesale Vendors ({vendors.length})
              </button>
              <button
                onClick={() => setActiveTab('POS')}
                className={`pb-3 px-6 font-bold text-sm tracking-wider uppercase border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'POS' 
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <FileText size={16} /> Purchase Orders ({purchaseOrders.length})
              </button>
            </div>

            {/* Tab Body: Vendors */}
            {activeTab === 'VENDORS' && (
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
                {/* Search Bar */}
                <div className="relative mb-6">
                  <input
                    type="text"
                    placeholder="Search vendors by name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
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
                        <tr className="border-b border-white/5 text-cyan-300 font-bold text-sm tracking-wider uppercase">
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
                              <div className="text-xs text-cyan-400/70">ID: #{v.id}</div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-3 py-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 rounded-full font-bold text-xs">
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
                                  className="p-2 text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
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
                    {purchaseOrders.map(po => (
                      <div key={po.id} className="glass-panel p-5 rounded-2xl border-white/5 hover:border-white/10 flex flex-col relative overflow-hidden group">
                        
                        {/* PO Status Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Order ID: #{po.id}</div>
                            <h3 className="font-extrabold text-white mt-0.5">{po.vendor_name}</h3>
                          </div>
                          
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            po.status === 'Received'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : po.status === 'Cancelled'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.15)] animate-pulse'
                          }`}>
                            {po.status}
                          </span>
                        </div>

                        {/* PO Summary Grid */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl border border-white/5 mb-4 text-xs">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Calendar size={14} className="text-cyan-400" />
                            <span>{new Date(po.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <Package size={14} className="text-cyan-400" />
                            <span>{po.items?.length || 0} Products</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400 col-span-2">
                            <DollarSign size={14} className="text-cyan-400" />
                            <span className="font-bold text-white">Cost: Rs. {po.total_cost.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* List items briefly */}
                        {po.items && po.items.length > 0 && (
                          <div className="mb-4 text-[11px] text-gray-400 max-h-24 overflow-y-auto space-y-1 scrollbar-none pr-1">
                            {po.items.map(item => (
                              <div key={item.id} className="flex justify-between border-b border-white/5 pb-1">
                                <span className="truncate pr-2">{item.product_name}</span>
                                <span className="font-bold text-gray-300">x{item.qty}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Interactive Receive Actions */}
                        {po.status === 'Pending' && (
                          <button
                            onClick={() => handleReceivePO(po.id)}
                            className="mt-auto py-2.5 w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-xl font-bold text-xs tracking-wider uppercase transition flex justify-center items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                          >
                            <CheckCircle size={14} /> Receive Inventory Shipment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Modal: Vendor Add / Edit */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2.5">
              <Truck className="text-cyan-400" />
              {editingVendor ? 'Edit Vendor Profile' : 'Register New Vendor'}
            </h3>

            <form onSubmit={handleSaveVendor} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. National Foods Ltd"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Wholesale Category</label>
                <input
                  type="text"
                  required
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. Groceries, Drinks, Snacks"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Contact Email / Phone / Support</label>
                <input
                  type="text"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. sales@nationalfoods.com or 021-344234"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="px-5 py-3 glass-button rounded-xl font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
