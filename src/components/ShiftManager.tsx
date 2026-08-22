import React, { useState, useEffect } from 'react';
import { User, Shift } from '../types';
import { Shield, Clock, Power, Sparkles, TrendingUp, Award, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface ShiftManagerProps {
  currentUser: { id: number; name: string; role: string };
  onLogout: () => void;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({ currentUser, onLogout }) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftDuration, setShiftDuration] = useState<string>('00:00:00');
  
  // User Management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Cashier' | 'Manager' | 'Admin'>('Cashier');
  
  // Editing state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState<'Cashier' | 'Manager' | 'Admin'>('Cashier');

  useEffect(() => {
    loadShift();
    if (currentUser.role === 'Admin') {
      loadUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!activeShift) return;
    const interval = setInterval(() => {
      const start = new Date(activeShift.clock_in).getTime();
      const elapsed = Date.now() - start;
      
      const hrs = Math.floor(elapsed / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
      
      setShiftDuration(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeShift]);

  const loadShift = async () => {
    try {
      const shift = await window.api.getActiveShift(currentUser.id);
      if (shift) {
        setActiveShift(shift);
      } else {
        // Clock-in automatically if no active shift exists
        const newShiftId = await window.api.clockIn(currentUser.id);
        const newShift = await window.api.getActiveShift(currentUser.id);
        if (newShift) setActiveShift(newShift);
      }
    } catch (err) {
      console.error('Failed to manage shift:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await window.api.getAllUsers();
      setUsersList(res);
    } catch (err) {
      console.error('Failed to load users list:', err);
    }
  };

  const handleClockOut = async () => {
    if (activeShift && window.confirm('Clock out of your shift and lock terminal?')) {
      await window.api.clockOut(activeShift.id);
      setActiveShift(null);
      onLogout();
    }
  };

  // Add User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) return;
    try {
      await window.api.addUser({
        name: newUserName,
        pin: newUserPin,
        role: newUserRole
      });
      setNewUserName('');
      setNewUserPin('');
      setNewUserRole('Cashier');
      setIsAddingUser(false);
      loadUsers();
    } catch (err) {
      alert('Error creating user profile');
    }
  };

  // Update User
  const handleStartEdit = (user: any) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditPin(user.pin);
    setEditRole(user.role);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim() || !editPin.trim()) return;
    try {
      const success = await window.api.updateUser(id, {
        name: editName,
        pin: editPin,
        role: editRole
      });
      if (success) {
        setEditingUserId(null);
        loadUsers();
      }
    } catch (err) {
      alert('Failed to update user profile');
    }
  };

  // Delete User
  const handleDeleteUser = async (id: number) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own logged-in profile!");
      return;
    }
    if (window.confirm('Are you sure you want to permanently delete this user profile?')) {
      try {
        await window.api.deleteUser(id);
        loadUsers();
      } catch (err) {
        alert('Failed to delete user');
      }
    }
  };

  return (
    <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255, 255, 255, 0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Background Orbs */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-purple-600/10 blur-[80px] rounded-full"></div>
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-600/10 blur-[80px] rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        
        {/* Profile Card Header */}
        <div>
          <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Shield className="text-neutral-300 drop-shadow-[0_0_8px_rgba(200, 200, 200, 0.4)]" size={32} />
                Staff Dashboard
              </h2>
              <p className="text-gray-400 mt-1">Shift logs, role actions, and secure terminal control.</p>
            </div>
            
            <button 
              onClick={handleClockOut}
              className="px-5 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors font-bold flex items-center gap-2"
            >
              <Power size={18} /> Clock Out & Lock
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Active User Card */}
            <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neutral-200 to-neutral-500"></div>
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Active Operator</span>
                <h3 className="text-xl font-black text-white tracking-wide truncate">{currentUser.name}</h3>
              </div>
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/30 text-neutral-200 rounded-full font-black text-[9px] uppercase tracking-widest shadow-[0_0_10px_rgba(255, 255, 255, 0.15)]">
                  <Sparkles size={10} className="animate-spin" style={{ animationDuration: '6s' }} /> {currentUser.role}
                </span>
              </div>
            </div>

            {/* Shift Duration */}
            <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Active Duty Timer</span>
                <h3 className="text-3xl font-mono font-black text-white tracking-widest drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">{shiftDuration}</h3>
              </div>
              <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-4 font-medium uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping shrink-0" />
                <span>Clock-In: {activeShift ? new Date(activeShift.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
              </div>
            </div>

            {/* Shift Sales Stat */}
            <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden flex flex-col justify-between min-h-[145px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Shift Analytics</span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-white font-mono">Rs. 14.8k</h3>
                  <span className="text-[10px] text-neutral-200 font-black">+14.2%</span>
                </div>
              </div>
              
              {/* Curved SVG Sparkline Trend */}
              <div className="absolute bottom-0 right-0 left-0 h-10 opacity-30 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <path 
                    d="M0,25 Q15,10 30,20 T60,5 T90,15 L100,10 L100,30 L0,30 Z" 
                    fill="url(#emerald-glow)" 
                    stroke="#10b981" 
                    strokeWidth="1.5"
                  />
                  <defs>
                    <linearGradient id="emerald-glow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              
              <div className="text-[10px] text-neutral-200 flex items-center gap-1.5 mt-4 font-bold uppercase tracking-wider relative z-10">
                <TrendingUp size={12} className="animate-bounce" />
                <span>Sync Engine Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* User & Security Manager Panel (Admin Only) */}
        {currentUser.role === 'Admin' && (
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 mb-8 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Award className="text-neutral-200" size={22} />
                User & Security PIN Manager
              </h3>
              
              {!isAddingUser && (
                <button
                  onClick={() => setIsAddingUser(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition"
                >
                  <Plus size={16} /> Add Profile
                </button>
              )}
            </div>

            {/* Add User Form overlay/section */}
            {isAddingUser && (
              <form onSubmit={handleAddUserSubmit} className="p-4 rounded-xl bg-black/40 border border-white/5 mb-6 animate-in slide-in-from-top-4 duration-300">
                <h4 className="text-sm font-bold text-white mb-3">Create New Staff Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Connor"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Login PIN (digits)</label>
                    <input
                      type="text"
                      placeholder="e.g. 5678"
                      value={newUserPin}
                      onChange={e => setNewUserPin(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Assigned Role</label>
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value as any)}
                      className="w-full glass-input rounded-xl p-2.5 text-sm"
                    >
                      <option value="Cashier">Cashier</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin Manager</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition flex-1"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="px-3 py-2.5 glass-button text-gray-400 hover:text-white rounded-xl text-sm font-bold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List of Users */}
            <div className="overflow-x-auto overflow-y-auto max-h-[220px] pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-neutral-200 font-bold uppercase text-xs">
                    <th className="py-3 px-3">Staff Name</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Security PIN</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersList.map((user) => {
                    const isEditing = editingUserId === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="glass-input rounded-lg p-1.5 text-sm w-full"
                            />
                          ) : (
                            <span className="font-bold text-white">{user.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? (
                            <select
                              value={editRole}
                              onChange={e => setEditRole(e.target.value as any)}
                              className="glass-input rounded-lg p-1.5 text-sm"
                            >
                              <option value="Cashier">Cashier</option>
                              <option value="Manager">Manager</option>
                              <option value="Admin">Admin</option>
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-gray-300">
                              {user.role}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPin}
                              onChange={e => setEditPin(e.target.value)}
                              className="glass-input rounded-lg p-1.5 text-sm w-24"
                            />
                          ) : (
                            <span className="text-gray-400">•••• ({user.pin})</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(user.id)}
                                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-neutral-200 border border-emerald-500/20 rounded-lg"
                                  title="Save Changes"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 rounded-lg"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(user)}
                                  className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-neutral-200 border border-white/20 rounded-lg"
                                  title="Edit Credentials"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-lg"
                                  title="Delete User Profile"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Operations Controls */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Quick Operations</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button 
              disabled={currentUser.role !== 'Admin' && currentUser.role !== 'Manager'}
              className="py-4 rounded-xl glass-button text-gray-300 font-bold hover:text-white flex flex-col items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <TrendingUp size={20} className="text-neutral-200" />
              Void Transaction
            </button>
            <button 
              className="py-4 rounded-xl glass-button text-gray-300 font-bold hover:text-white flex flex-col items-center gap-2"
            >
              <Clock size={20} className="text-neutral-200" />
              Shift History
            </button>
            <button 
              onClick={onLogout}
              className="py-4 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-bold flex flex-col items-center gap-2"
            >
              <Power size={20} className="text-red-400" />
              Lock Terminal
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
