'use client';

import { useState, useEffect } from 'react';
import { Activity, Cpu, Zap, TrendingUp, Database, Clock } from 'lucide-react';

interface AdaptiveState {
  parameters: Record<string, number>;
  recentMetrics: Record<string, Array<{ name: string; value: number; timestamp: number }>>;
}

interface ActivityItem {
  action: string;
  timestamp: number;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PROCESS_START = typeof window !== 'undefined' ? Date.now() : 0;

export function SystemDashboard() {
  const [stats, setStats] = useState({
    totalConversations: 0,
    evolvedSolutions: 0,
    solvedProblems: 0,
    uptimeSeconds: 0,
  });
  const [adaptive, setAdaptive] = useState<AdaptiveState | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    try {
      const [statsRes, adaptiveRes, convRes, evoRes, csRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/adaptive'),
        fetch('/api/conversation'),
        fetch('/api/genetic/evolve?limit=5'),
        fetch('/api/constraint/solve?limit=5'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (adaptiveRes.ok) setAdaptive(await adaptiveRes.json());

      const items: ActivityItem[] = [];
      if (convRes.ok) {
        const { conversations } = await convRes.json();
        for (const c of (conversations || []).slice(0, 5)) {
          items.push({
            action: `New conversation: "${c.title}"`,
            timestamp: new Date(c.createdAt).getTime(),
          });
        }
      }
      if (evoRes.ok) {
        const { solutions } = await evoRes.json();
        for (const s of solutions || []) {
          items.push({
            action: `Evolved solution for "${s.problemType}" (fitness ${Number(s.fitness).toFixed(2)})`,
            timestamp: new Date(s.createdAt).getTime(),
          });
        }
      }
      if (csRes.ok) {
        const { problems } = await csRes.json();
        for (const p of problems || []) {
          items.push({
            action: `${p.isSolved ? 'Solved' : 'Attempted'} constraint problem "${p.name}"`,
            timestamp: new Date(p.createdAt).getTime(),
          });
        }
      }
      items.sort((a, b) => b.timestamp - a.timestamp);
      setActivity(items.slice(0, 6));
      setLoadError(null);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoadError('Some dashboard data could not be loaded.');
    }
  };

  const responseTimeMetrics = adaptive?.recentMetrics?.claude_response_time_ms || [];
  const latestResponseTime = responseTimeMetrics.length
    ? responseTimeMetrics[responseTimeMetrics.length - 1].value
    : null;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Activity className="w-8 h-8 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">System Dashboard</h2>
        </div>
        <p className="text-gray-300">
          Live data pulled from the database and the in-process self-adaptive system — no
          simulated/random values.
        </p>
        {loadError && <p className="text-yellow-400 text-sm mt-2">{loadError}</p>}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-2xl border border-blue-500/30 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Cpu className="w-8 h-8 text-blue-400" />
            <div className="text-blue-400 text-sm font-semibold">CHAT</div>
          </div>
          <div className="text-white text-4xl font-bold mb-2">{stats.totalConversations}</div>
          <div className="text-gray-300">Total Conversations</div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-2xl border border-green-500/30 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <div className="text-green-400 text-sm font-semibold">EVOLUTION</div>
          </div>
          <div className="text-white text-4xl font-bold mb-2">{stats.evolvedSolutions}</div>
          <div className="text-gray-300">Solutions Evolved</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl border border-purple-500/30 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Database className="w-8 h-8 text-purple-400" />
            <div className="text-purple-400 text-sm font-semibold">CONSTRAINTS</div>
          </div>
          <div className="text-white text-4xl font-bold mb-2">{stats.solvedProblems}</div>
          <div className="text-gray-300">Problems Solved</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Performance Metrics</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Last Claude Response Time</span>
              <span className="text-white font-bold">
                {latestResponseTime !== null ? `${latestResponseTime.toFixed(0)}ms` : 'No data yet'}
              </span>
            </div>
            <div className="bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all"
                style={{
                  width: latestResponseTime !== null
                    ? `${Math.min((latestResponseTime / 5000) * 100, 100)}%`
                    : '0%',
                }}
              />
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Recorded from real /api/claude calls; empty until you send a chat message.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Dashboard Session Uptime</span>
              </span>
              <span className="text-white font-bold">{formatUptime(stats.uptimeSeconds)}</span>
            </div>
            <div className="bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full w-full" />
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Time since the server process started (resets on redeploy/cold start).
            </p>
          </div>
        </div>
      </div>

      {/* Self-Adaptive Parameters */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          <span>Self-Adaptive Parameters</span>
        </h3>

        <div className="space-y-4">
          {adaptive && Object.keys(adaptive.parameters).length > 0 ? (
            Object.entries(adaptive.parameters).map(([name, value]) => (
              <div key={name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 capitalize">{name.replace(/_/g, ' ')}</span>
                  <span className="text-white font-bold">{value.toFixed(3)}</span>
                </div>
                <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">Loading adaptive parameters…</p>
          )}
        </div>
      </div>

      {/* System Features */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Active Features</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Claude AI', status: true, color: 'blue' },
            { name: 'Genetic Programming', status: true, color: 'green' },
            { name: 'Constraint Solving', status: true, color: 'purple' },
            { name: 'Neuro-Symbolic', status: true, color: 'orange' },
            { name: 'Self-Adaptation', status: true, color: 'yellow' },
          ].map((feature) => (
            <div
              key={feature.name}
              className={`bg-${feature.color}-500/20 border border-${feature.color}-500/50 rounded-lg p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-2 h-2 rounded-full bg-${feature.color}-400 ${feature.status ? 'animate-pulse' : ''}`} />
                <div className={`text-${feature.color}-400 text-xs font-semibold`}>
                  {feature.status ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>
              <div className="text-white font-semibold text-sm">{feature.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity (real, from the database) */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>

        <div className="space-y-3">
          {activity.length === 0 && (
            <p className="text-gray-400 text-sm">No activity recorded yet.</p>
          )}
          {activity.map((item, index) => (
            <div
              key={index}
              className="bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <div className="text-white">{item.action}</div>
              </div>
              <div className="text-gray-400 text-sm">{timeAgo(item.timestamp)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
