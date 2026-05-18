import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Receipt, RefreshCw, Star, Calendar } from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
  };
  salesByMethod: Array<{ method: string; value: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number }>;
}

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          <RefreshCw className="animate-spin text-cyan-400 mx-auto mb-4" size={40} />
          <p className="text-gray-400 font-bold">Compiling Financial Trends...</p>
        </div>
      </div>
    );
  }

  // Calculate maximum revenue for SVG graph scaling
  const maxRevenue = data.dailyTrend.length > 0
    ? Math.max(...data.dailyTrend.map(d => d.revenue), 100)
    : 100;

  // Generate SVG Path for line chart
  const generateSvgPath = () => {
    if (data.dailyTrend.length < 2) return '';
    const width = 500;
    const height = 150;
    const points = data.dailyTrend.map((d, i) => {
      const x = (i / (data.dailyTrend.length - 1)) * (width - 40) + 20;
      const y = height - (d.revenue / maxRevenue) * (height - 40) - 20;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  // Generate Area SVG Path for glowing gradient fill under the line chart
  const generateSvgAreaPath = () => {
    if (data.dailyTrend.length < 2) return '';
    const width = 500;
    const height = 150;
    const points = data.dailyTrend.map((d, i) => {
      const x = (i / (data.dailyTrend.length - 1)) * (width - 40) + 20;
      const y = height - (d.revenue / maxRevenue) * (height - 40) - 20;
      return `${x},${y}`;
    });
    const startX = 20;
    const endX = (data.dailyTrend.length - 1) / (data.dailyTrend.length - 1) * (width - 40) + 20;
    return `M ${startX},${height - 10} L ${points.join(' L ')} L ${endX},${height - 10} Z`;
  };

  return (
    <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.05)] h-full flex flex-col relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] -mr-40 -mt-40 rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 blur-[100px] -ml-40 -mb-40 rounded-full"></div>

      <div className="relative z-10 flex flex-col h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <TrendingUp className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" size={32} />
              Financial & Sales Analytics
            </h2>
            <p className="text-gray-400 mt-1">Live store performance, tax reports, and volume trends.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAnalytics}
              className="p-3 glass-button rounded-xl text-cyan-400 hover:text-cyan-300 transition-all flex items-center gap-2"
            >
              <RefreshCw size={18} /> Refresh
            </button>
            <div className="px-4 py-2.5 glass-panel rounded-xl border border-white/5 bg-white/5 text-gray-300 text-sm font-bold flex items-center gap-2">
              <Calendar size={16} className="text-purple-400" />
              <span>Last 7 Days</span>
            </div>
          </div>
        </div>

        {/* Metrics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Revenue */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Sales Revenue</span>
              <DollarSign size={20} className="text-cyan-400" />
            </div>
            <h3 className="text-3xl font-black text-white drop-shadow-md">
              Rs. {data.summary.totalRevenue.toFixed(2)}
            </h3>
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-3">
              <TrendingUp size={12} /> Live synchronized
            </p>
          </div>

          {/* Card 2: Orders */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Completed Orders</span>
              <Receipt size={20} className="text-purple-400" />
            </div>
            <h3 className="text-3xl font-black text-white drop-shadow-md">
              {data.summary.totalOrders}
            </h3>
            <p className="text-xs text-purple-400 flex items-center gap-1 mt-3">
              <Star size={12} /> EOD Target: 100
            </p>
          </div>

          {/* Card 3: Avg Ticket */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 relative overflow-hidden shadow-lg group hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Average Ticket Size</span>
              <ShoppingBag size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-3xl font-black text-white drop-shadow-md">
              Rs. {data.summary.avgTicket.toFixed(2)}
            </h3>
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-3">
              <TrendingUp size={12} /> Target: Rs. 5,000.00
            </p>
          </div>
        </div>

        {/* Charts & Lists Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
          {/* Left Column: Weekly Trend Line Chart */}
          <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 flex flex-col justify-between shadow-lg">
            <div>
              <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <TrendingUp size={18} className="text-cyan-400" />
                Sales Trend (Daily)
              </h4>
              <p className="text-xs text-gray-400 mb-4">Volume aggregate for last 7 calendar days.</p>
            </div>

            {/* SVG Trend Graph */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-[160px] bg-black/20 rounded-xl border border-white/5 relative">
              {data.dailyTrend.length < 2 ? (
                <span className="text-gray-500 font-semibold">Insufficient historical data to graph.</span>
              ) : (
                <svg viewBox="0 0 500 150" className="w-full h-full">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Glowing backdrop area */}
                  <path d={generateSvgAreaPath()} fill="url(#areaGrad)" />
                  
                  {/* Line Chart Path */}
                  <path
                    d={generateSvgPath()}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                  />

                  {/* Nodes / Dots */}
                  {data.dailyTrend.map((d, i) => {
                    const x = (i / (data.dailyTrend.length - 1)) * (500 - 40) + 20;
                    const y = 150 - (d.revenue / maxRevenue) * (150 - 40) - 20;
                    return (
                      <g key={i} className="group cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#ffffff"
                          stroke="#06b6d4"
                          strokeWidth="2.5"
                          className="transition duration-300 hover:scale-150"
                        />
                        <text
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          fill="#22d3ee"
                          fontSize="9"
                          fontWeight="bold"
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-black duration-300"
                        >
                          Rs. {d.revenue.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            {/* X Axis Labels */}
            {data.dailyTrend.length >= 2 && (
              <div className="flex justify-between px-4 mt-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <span>{data.dailyTrend[0].date}</span>
                <span>{data.dailyTrend[data.dailyTrend.length - 1].date}</span>
              </div>
            )}
          </div>

          {/* Right Column: Best Sellers & Methods */}
          <div className="flex flex-col gap-6">
            {/* Top Products Table */}
            <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 flex-1 flex flex-col justify-between overflow-hidden shadow-lg">
              <div>
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Star size={18} className="text-purple-400" />
                  Top Performing Products
                </h4>
                <div className="overflow-y-auto max-h-[140px] pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-cyan-300/80 font-bold text-xs uppercase">
                        <th className="py-2 px-2">Item Name</th>
                        <th className="py-2 px-2 text-center">Qty Sold</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-2 font-bold text-white">{p.name}</td>
                          <td className="py-2.5 px-2 text-center text-gray-300 font-semibold">{p.qty}</td>
                          <td className="py-2.5 px-2 text-right text-emerald-400 font-extrabold">Rs. {p.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sales by Payment Method Bar Chart */}
            <div className="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 flex-1 flex flex-col justify-between shadow-lg">
              <div>
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-cyan-400" />
                  Sales by Method
                </h4>
                <div className="space-y-3">
                  {data.salesByMethod.map((m, idx) => {
                    const maxVal = Math.max(...data.salesByMethod.map(v => v.value), 1);
                    const pct = (m.value / maxVal) * 100;
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs font-bold text-gray-400">
                          <span>{m.method}</span>
                          <span className="text-white">Rs. {m.value.toFixed(2)}</span>
                        </div>
                        {/* Horizontal glass progress bar */}
                        <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full shadow-[0_0_8px_rgba(0,240,255,0.4)]"
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
