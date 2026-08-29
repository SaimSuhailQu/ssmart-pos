import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Receipt, RefreshCw, Star, Calendar, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
  };
  salesByMethod: Array<{ method: string; value: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number; refunds: number; cost: number; expenses?: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; refunds: number; cost: number; expenses?: number }>;
  yearlyTrend: Array<{ year: string; revenue: number; refunds: number; cost: number; expenses?: number }>;
  financials: {
    today: { revenue: number; refunds: number; cost: number; profit: number; orders: number; expenses: number };
    month: { revenue: number; refunds: number; cost: number; profit: number; orders: number; expenses: number };
    year: { revenue: number; refunds: number; cost: number; profit: number; orders: number; expenses: number };
  };
}

type ScopeMode = 'TODAY' | 'MONTH' | 'YEAR';
type TrendMode = 'DAILY' | 'MONTHLY' | 'YEARLY';

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Interactive navigation states
  const [activeScope, setActiveScope] = useState<ScopeMode>('TODAY');
  const [activeTrend, setActiveTrend] = useState<TrendMode>('DAILY');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.getSalesAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-white/10 flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="animate-spin text-neutral-200 mx-auto mb-4" size={40} />
          <p className="text-gray-400 font-bold">Compiling Financial Trends...</p>
        </div>
      </div>
    );
  }

  // Get current active scope values
  const getActiveScopeDetails = () => {
    switch (activeScope) {
      case 'TODAY':
        return { label: 'Today', ...data.financials.today };
      case 'MONTH':
        return { label: 'This Month', ...data.financials.month };
      case 'YEAR':
        return { label: 'This Year', ...data.financials.year };
    }
  };

  const scope = getActiveScopeDetails();

  // Get active trend dataset
  const getTrendData = () => {
    if (activeTrend === 'DAILY') {
      return data.dailyTrend.map(d => ({
        label: d.date.substring(5), // mm-dd format for cleaner labels
        revenue: d.revenue,
        profit: d.revenue - d.refunds - d.cost - (d.expenses || 0)
      }));
    } else if (activeTrend === 'MONTHLY') {
      return data.monthlyTrend.map(d => ({
        label: d.month,
        revenue: d.revenue,
        profit: d.revenue - d.refunds - d.cost - (d.expenses || 0)
      }));
    } else {
      return data.yearlyTrend.map(d => ({
        label: d.year,
        revenue: d.revenue,
        profit: d.revenue - d.refunds - d.cost - (d.expenses || 0)
      }));
    }
  };

  const trendData = getTrendData();

  // Calculate scales for SVG
  const maxVal = trendData.length > 0
    ? Math.max(...trendData.flatMap(d => [d.revenue, d.profit, 100]))
    : 100;
  const minVal = trendData.length > 0
    ? Math.min(...trendData.flatMap(d => [d.revenue, d.profit, 0]))
    : 0;

  const range = maxVal - minVal || 1;
  const width = 600;
  const height = 200;

  const getSvgY = (val: number) => {
    return height - ((val - minVal) / range) * (height - 50) - 25;
  };

  const getSvgX = (index: number) => {
    if (trendData.length < 2) return width / 2;
    return (index / (trendData.length - 1)) * (width - 80) + 40;
  };

  const generateSvgLinePath = (key: 'revenue' | 'profit') => {
    if (trendData.length < 2) return '';
    const points = trendData.map((d, i) => `${getSvgX(i)},${getSvgY(d[key])}`);
    return `M ${points.join(' L ')}`;
  };

  const generateSvgAreaPath = (key: 'revenue' | 'profit') => {
    if (trendData.length < 2) return '';
    const points = trendData.map((d, i) => `${getSvgX(i)},${getSvgY(d[key])}`);
    const startX = getSvgX(0);
    const endX = getSvgX(trendData.length - 1);
    return `M ${startX},${height - 15} L ${points.join(' L ')} L ${endX},${height - 15} Z`;
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255, 255, 255, 0.05)] h-full flex flex-col relative overflow-hidden font-outfit animate-in fade-in duration-300">
      
      {/* Background Neon Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] -mr-40 -mt-40 rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 blur-[100px] -ml-40 -mb-40 rounded-full pointer-events-none"></div>

      <div className="relative z-10 flex flex-col h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <TrendingUp className="text-neutral-200 drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.4)]" size={32} />
              Financial & Sales Analytics
            </h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">E-Commerce Store performance & profit trackers</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-neutral-200 hover:text-neutral-200 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            
            {/* Range Scope Switcher */}
            <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
              {(['TODAY', 'MONTH', 'YEAR'] as ScopeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setActiveScope(mode)}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                    activeScope === mode
                      ? 'bg-white/20 text-neutral-200 border border-white/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {mode === 'TODAY' ? 'Daily' : mode === 'MONTH' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope-based Financial Statistics Banner */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          
          {/* Revenue */}
          <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neutral-200 to-neutral-400"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">{scope.label} Sales Revenue</span>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-white font-mono drop-shadow-md">
                Rs. {scope.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-neutral-200">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="text-[10px] text-neutral-200 font-bold uppercase tracking-wider mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> Gross Sales
            </div>
          </div>

          {/* Refunded */}
          <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-orange-500"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">{scope.label} Refunds</span>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-red-400 font-mono drop-shadow-md">
                Rs. {scope.refunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                <ArrowDownRight size={16} />
              </div>
            </div>
            <div className="text-[10px] text-red-400/70 font-bold uppercase tracking-wider mt-3">
              Returned Capital
            </div>
          </div>

          {/* Expenses */}
          <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">{scope.label} Expenses</span>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-amber-400 font-mono drop-shadow-md">
                Rs. {scope.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Receipt size={16} />
              </div>
            </div>
            <div className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wider mt-3">
              Mart Operational Costs
            </div>
          </div>

          {/* Profit */}
          <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">{scope.label} Net Profit</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl font-black font-mono drop-shadow-md ${scope.profit >= 0 ? 'text-neutral-200' : 'text-red-400'}`}>
                Rs. {scope.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${scope.profit >= 0 ? 'bg-white/10 text-neutral-200' : 'bg-red-500/10 text-red-400'}`}>
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-wider mt-3 flex items-center gap-1 ${scope.profit >= 0 ? 'text-neutral-200' : 'text-red-400'}`}>
              Profit Margin: {scope.revenue > 0 ? ((scope.profit / scope.revenue) * 100).toFixed(1) : 0}%
            </div>
          </div>

          {/* Orders Count */}
          <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500"></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">{scope.label} Transactions</span>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-white font-mono drop-shadow-md">
                {scope.orders} Orders
              </h3>
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-neutral-300">
                <ShoppingBag size={16} />
              </div>
            </div>
            <div className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider mt-3">
              Average Ticket: Rs. {scope.orders > 0 ? (scope.revenue / scope.orders).toFixed(2) : '0.00'}
            </div>
          </div>

        </div>

        {/* Charts & Trends Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
          
          {/* Trends Chart Panel (Takes up 2 columns) */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 flex flex-col justify-between shadow-lg lg:col-span-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Activity size={18} className="text-neutral-200" />
                  Financial & Margin Trends
                </h4>
                <p className="text-xs text-gray-400">Live graphical vectors of sales volume relative to inventory cost.</p>
              </div>

              {/* Trend Mode Switcher */}
              <div className="flex bg-black/40 border border-white/5 rounded-lg p-0.5">
                {(['DAILY', 'MONTHLY', 'YEARLY'] as TrendMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveTrend(mode)}
                    className={`px-3 py-1 rounded-md text-[9px] font-black tracking-widest uppercase transition-all ${
                      activeTrend === mode
                        ? 'bg-white/20 text-neutral-200'
                        : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {mode === 'DAILY' ? '30 Days' : mode === 'MONTHLY' ? '12 Months' : '5 Years'}
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Interactive Multi-Line Trend Chart */}
            <div className="flex-1 flex flex-col justify-center p-4 min-h-[220px] bg-black/25 rounded-xl border border-white/5 relative">
              {trendData.length < 2 ? (
                <div className="text-center py-10">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Insufficient trend aggregate records found.</span>
                  <p className="text-[10px] text-gray-600 mt-1">Complete sales checkouts to populate timeline statistics.</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col">
                  {/* Legend Indicators */}
                  <div className="flex gap-4 justify-end text-[10px] font-bold uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5 text-neutral-200">
                      <span className="w-2.5 h-1 bg-cyan-400 rounded"></span> Gross Sales
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-200">
                      <span className="w-2.5 h-1 bg-emerald-400 rounded"></span> Net Profit
                    </span>
                  </div>

                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    <line x1="40" y1={getSvgY(minVal)} x2={width-40} y2={getSvgY(minVal)} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
                    <line x1="40" y1={getSvgY(maxVal)} x2={width-40} y2={getSvgY(maxVal)} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />
                    <line x1="40" y1={getSvgY((maxVal + minVal)/2)} x2={width-40} y2={getSvgY((maxVal + minVal)/2)} stroke="rgba(255,255,255,0.03)" strokeDasharray="3,3" />

                    {/* Gradient Fill under lines */}
                    <path d={generateSvgAreaPath('revenue')} fill="url(#revenueGrad)" />
                    <path d={generateSvgAreaPath('profit')} fill="url(#profitGrad)" />
                    
                    {/* Line paths */}
                    <path
                      d={generateSvgLinePath('revenue')}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_8px_rgba(255, 255, 255, 0.3)]"
                    />

                    <path
                      d={generateSvgLinePath('profit')}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                    />

                    {/* Nodes / Dots */}
                    {trendData.map((d, i) => {
                      const cx = getSvgX(i);
                      const cyRev = getSvgY(d.revenue);
                      const cyProf = getSvgY(d.profit);

                      return (
                        <g key={i} className="group cursor-pointer">
                          <circle cx={cx} cy={cyRev} r="4" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
                          <circle cx={cx} cy={cyProf} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                          
                          {/* Tooltip labels */}
                          <text
                            x={cx}
                            y={Math.min(cyRev, cyProf) - 15}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="8"
                            fontWeight="900"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-black duration-300"
                          >
                            Rev: Rs. {d.revenue.toFixed(0)} | Prof: Rs. {d.profit.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* X Axis Labels */}
            {trendData.length >= 2 && (
              <div className="flex justify-between px-6 mt-3 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                <span>{trendData[0].label}</span>
                <span>{trendData[Math.floor(trendData.length/2)].label}</span>
                <span>{trendData[trendData.length - 1].label}</span>
              </div>
            )}
          </div>

          {/* Right Column: Best Sellers and Sales by Method */}
          <div className="flex flex-col gap-6">
            
            {/* Top Products */}
            <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 flex-1 flex flex-col justify-between overflow-hidden shadow-lg">
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Star size={16} className="text-neutral-300" />
                  Top Products
                </h4>
                <div className="overflow-y-auto max-h-[110px] pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-neutral-200/80 font-bold uppercase">
                        <th className="py-2 px-1">Item</th>
                        <th className="py-2 px-1 text-center">Qty</th>
                        <th className="py-2 px-1 text-right">Gross</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-1 font-bold text-white truncate max-w-[120px]">{p.name}</td>
                          <td className="py-2 px-1 text-center text-gray-300 font-semibold">{p.qty}</td>
                          <td className="py-2 px-1 text-right text-neutral-200 font-black">Rs. {p.revenue.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sales by Method */}
            <div className="glass-panel p-5 rounded-2xl border-white/5 bg-white/5 flex-1 flex flex-col justify-between shadow-lg">
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <DollarSign size={16} className="text-neutral-200" />
                  Payment Methods
                </h4>
                <div className="space-y-2.5">
                  {data.salesByMethod.map((m, idx) => {
                    const maxVal = Math.max(...data.salesByMethod.map(v => v.value), 1);
                    const pct = (m.value / maxVal) * 100;
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                          <span>{m.method}</span>
                          <span className="text-white">Rs. {m.value.toFixed(0)}</span>
                        </div>
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-neutral-200 to-neutral-500 rounded-full shadow-[0_0_8px_rgba(255, 255, 255, 0.4)]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
