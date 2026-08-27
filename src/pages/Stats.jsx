// Stats & History Dashboard

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Footprints, Trash2, Download, ChevronRight, Trophy, Clock, Zap, Activity, MapPin } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../components/ui/Card';
import { aggregateWalks } from '../domain/analytics/derivedValues.js';
import {
  getWalks,
  deleteWalk,
  getChartData,
  getPersonalRecords,
} from '../application/stores/dataStore.js';

import useUserStore from '../stores/userStore';
import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatDate,
  formatTime,
} from '../utils/formatters';

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    let suffix = '';
    if (payload[0].dataKey === 'distance') suffix = ` ${unit}`;
    if (payload[0].dataKey === 'duration') suffix = ' min';
    if (payload[0].dataKey === 'steps') suffix = ' steps';
    if (payload[0].dataKey === 'calories') suffix = ' kcal';
    
    return (
      <div className="bg-[#111827] border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md">
        <p className="text-xs text-[var(--text-secondary)] font-bold mb-1 uppercase tracking-widest">{label}</p>
        <p className="text-[15px] font-bold text-white">
          {payload[0].value.toLocaleString()}
          <span className="text-[var(--text-secondary)] font-medium ml-1">{suffix}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Stats() {
  const navigate = useNavigate();
  const { unit } = useUserStore();
  const [activeTab, setActiveTab] = useState('charts'); // 'charts' | 'log'
  const [chartMetric, setChartMetric] = useState('distance'); // distance | steps | duration | calories
  
  const [walks, setWalks] = useState([]);
  const [prs, setPrs] = useState(null);
  const [chartData, setChartData] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allWalks = getWalks();
      setWalks(allWalks);
      
      if (allWalks.length > 0) {
        setPrs(getPersonalRecords(allWalks));
        setChartData(getChartData(allWalks, 'week'));
      }
    } catch (error) {
      console.error('Failed to load walks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, walkId) => {
    e.stopPropagation();
    if (confirm('Delete this walk?')) {
      await deleteWalk(walkId);
      const filtered = walks.filter((w) => w.id !== walkId);
      setWalks(filtered);
      if (filtered.length > 0) {
        setPrs(getPersonalRecords(filtered));
        setChartData(getChartData(filtered, 'week'));
      } else {
        setPrs(null);
        setChartData([]);
      }
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(walks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walktracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Log View logic
  const filteredWalks = walks.filter((walk) => {
    if (filter === 'all') return true;
    const now = new Date();
    const walkDate = new Date(walk.date);
    if (filter === 'week') return walkDate >= new Date(now - 7 * 86400000);
    if (filter === 'month') return walkDate >= new Date(now - 30 * 86400000);
    return true;
  });

  const groupedWalks = {};
  filteredWalks.forEach((walk) => {
    if (!groupedWalks[walk.date]) groupedWalks[walk.date] = [];
    groupedWalks[walk.date].push(walk);
  });

  const totalStats = aggregateWalks(filteredWalks);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--bg)] pb-28">
      {/* Header */}
      <div className="pt-14 pb-4 safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Statistics
            </h1>
            <p className="text-[var(--text-secondary)] text-sm font-medium mt-1">
              {walks.length} walks recorded
            </p>
          </div>
          {activeTab === 'log' && walks.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleExport}
              className="w-11 h-11 rounded-2xl card-elevated flex items-center justify-center"
              aria-label="Export walks"
            >
              <Download size={18} className="text-[var(--text-secondary)]" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="mt-4 mb-6">
        <div className="flex gap-2 p-1.5 bg-[var(--card)] rounded-2xl shadow-inner border border-white/5">
          {[
            { key: 'charts', label: 'Overview' },
            { key: 'log', label: 'History Log' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${
                activeTab === tab.key ? 'text-white shadow-md' : 'text-[var(--text-secondary)]'
              }`}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeTabBadge"
                  className="absolute inset-0 bg-[#374151] rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : walks.length === 0 ? (
        <div>
          <Card className="text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818CF8' }}
            >
              <Footprints size={28} />
            </div>
            <p className="font-semibold text-[15px]" style={{ fontFamily: 'var(--font-heading)' }}>
              No data yet
            </p>
            <p className="text-[var(--text-secondary)] text-sm mt-1.5 max-w-[220px] mx-auto">
              Start your first walk to unlock insights and history!
            </p>
          </Card>
        </div>
      ) : activeTab === 'charts' ? (
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
          {/* Charts Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[15px]" style={{ fontFamily: 'var(--font-heading)' }}>Last 7 Days</h3>
              <select 
                value={chartMetric} 
                onChange={(e) => setChartMetric(e.target.value)}
                className="bg-[var(--bg)] border border-[var(--border)] text-xs font-bold text-[var(--text)] rounded-lg px-2 py-1 outline-none"
              >
                <option value="distance">Distance</option>
                <option value="steps">Steps</option>
                <option value="duration">Time</option>
                <option value="calories">Calories</option>
              </select>
            </div>
            
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <Tooltip 
                    content={<CustomTooltip unit={unit} />}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar 
                    dataKey={chartMetric} 
                    radius={[4, 4, 0, 0]} 
                    fill="url(#colorMetric)"
                  />
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818CF8" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Personal Records */}
          {prs && (
            <div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest pl-1 mb-3">
                All-Time Bests
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: MapPin, title: 'Furthest Walk', val: formatDistance(prs.longestSingleWalk, unit), unit: unit, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
                  { icon: Clock, title: 'Longest Time', val: formatDuration(prs.longestDuration), unit: '', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
                  { icon: Footprints, title: 'Most Steps', val: formatNumber(prs.mostSteps), unit: 'steps', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
                  { icon: Zap, title: 'Top Pace', val: prs.fastestPace > 0 && prs.fastestPace < Infinity ? `${prs.fastestPace.toFixed(1)}` : '--', unit: `min/${unit}`, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
                ].map((pr, i) => (
                  <Card key={i} className="flex flex-col gap-3 p-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: pr.bg, color: pr.color }}>
                      <pr.icon size={15} />
                    </div>
                    <div>
                      <p className="text-label text-[var(--text-secondary)] mb-0.5">{pr.title}</p>
                      <p className="text-[17px] font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                        {pr.val} <span className="text-small text-[var(--text-secondary)] ml-0.5">{pr.unit}</span>
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          {/* Filter Sub-Tabs for Log View */}
          <div className="flex gap-2 mb-6">
            {[
              { key: 'all', label: 'All Time' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`py-1.5 px-4 rounded-full text-[11px] font-bold border transition-all ${
                  filter === t.key
                    ? 'border-[#818CF8] bg-[#818CF8]/10 text-[#818CF8]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-white/20'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Card className="mb-8">
            <div className="grid grid-cols-4 gap-2 text-center py-2 relative">
              {[
                { value: formatDistance(totalStats.distance, unit), label: unit },
                { value: formatNumber(totalStats.steps), label: 'Steps' },
                { value: formatNumber(totalStats.calories), label: 'kcal' },
                { value: formatDuration(totalStats.duration), label: 'Time' },
              ].map((s, i) => (
                <div key={i} className={i !== 3 ? 'border-r border-[var(--border)]/50' : ''}>
                  <p className="text-[15px] font-bold leading-none" style={{ fontFamily: 'var(--font-heading)' }}>
                    {s.value}
                  </p>
                  <p className="text-[var(--text-secondary)] text-[9px] mt-1.5 font-bold uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Log List */}
          {Object.entries(groupedWalks).map(([date, dayWalks]) => (
            <div key={date} className="mb-6">
              <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 pl-1">
                {formatDate(date)}
              </p>
              <div className="space-y-3">
                {dayWalks.map((walk, i) => (
                  <motion.div
                    key={walk.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div
                      onClick={() => navigate(`/walk-summary/${walk.id}`)}
                      className="flex items-center gap-4 bg-[var(--card)] border border-[var(--border)] p-3 rounded-2xl active:opacity-70 transition-opacity cursor-pointer"
                    >
                      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1))' }}
                      >
                        <Footprints size={16} className="text-[#818CF8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between pointer-events-none">
                          <p className="font-bold text-sm">{formatTime(walk.startTime)}</p>
                          <button
                            onClick={(e) => handleDelete(e, walk.id)}
                            className="p-1 pointer-events-auto hover:bg-white/5 rounded-full"
                            aria-label="Delete walk"
                          >
                            <Trash2 size={13} className="text-[var(--text-secondary)] opacity-60" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-secondary)] font-bold tracking-wide">
                          <span className="text-white/80">{formatDistance(walk.distance, unit)} {unit}</span>
                          <span className="w-1 h-1 rounded-full bg-[var(--text-secondary)]/30" />
                          <span>{formatDuration(walk.duration)}</span>
                          <span className="w-1 h-1 rounded-full bg-[var(--text-secondary)]/30" />
                          <span>{formatNumber(walk.steps)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
