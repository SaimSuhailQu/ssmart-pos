import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Search, Edit2, Trash2, Award, UserPlus, Phone, Mail } from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await window.api.getAllCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setPoints(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setPoints(customer.points);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await window.api.updateCustomer(editingCustomer.id, { name, phone, email, points });
      } else {
        await window.api.addCustomer({ name, phone, email, points });
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (err) {
      console.error('Failed to save customer:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this customer profile?')) {
      await window.api.deleteCustomer(id);
      loadCustomers();
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Award className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" size={32} />
              CRM & Loyalty Program
            </h2>
            <p className="text-gray-400 mt-1">Manage points, purchase history, and target promos.</p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            <UserPlus size={18} /> Add Customer
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-cyan-300 font-bold text-sm tracking-wider uppercase">
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Contact</th>
                <th className="py-4 px-4 text-center">Loyalty Points</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="font-extrabold text-white">{c.name}</div>
                    <div className="text-xs text-cyan-400/70">ID: #{c.id}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1">
                      {c.phone && <span className="text-gray-300 text-sm flex items-center gap-1.5"><Phone size={12} className="text-cyan-400/70" /> {c.phone}</span>}
                      {c.email && <span className="text-gray-400 text-xs flex items-center gap-1.5"><Mail size={12} className="text-purple-400/70" /> {c.email}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full font-bold text-sm">
                      <Award size={14} /> {c.points} pts
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-2 text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
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
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-300 relative shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Award className="text-cyan-400" />
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. Michael Jordan"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. 555-0199"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl"
                  placeholder="e.g. mj@chicago.com"
                />
              </div>

              {editingCustomer && (
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Adjust Loyalty Points</label>
                  <input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full px-4 py-3 glass-input rounded-xl"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
