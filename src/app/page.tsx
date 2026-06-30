'use client';

import { useState, useEffect } from 'react';
import { ClaudeChat } from '@/components/ClaudeChat';
import { GeneticAlgorithm } from '@/components/GeneticAlgorithm';
import { ConstraintSolver } from '@/components/ConstraintSolver';
import { SystemDashboard } from '@/components/SystemDashboard';
import { NeuroSymbolic } from '@/components/NeuroSymbolic';
import { GettingStarted } from '@/components/GettingStarted';
import {
  Brain,
  Dna,
  Network,
  Activity,
  Sparkles,
  Cpu,
  Zap,
} from 'lucide-react';

type Tab = 'chat' | 'genetic' | 'constraint' | 'neuro' | 'dashboard';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading AI System...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'chat' as Tab, name: 'Claude AI', icon: Brain, color: 'from-blue-500 to-cyan-500' },
    { id: 'genetic' as Tab, name: 'Genetic Programming', icon: Dna, color: 'from-green-500 to-emerald-500' },
    { id: 'constraint' as Tab, name: 'Constraint Solver', icon: Network, color: 'from-purple-500 to-pink-500' },
    { id: 'neuro' as Tab, name: 'Neuro-Symbolic', icon: Sparkles, color: 'from-orange-500 to-red-500' },
    { id: 'dashboard' as Tab, name: 'System Dashboard', icon: Activity, color: 'from-indigo-500 to-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <GettingStarted />
      
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Advanced AI System</h1>
                <p className="text-gray-300 text-sm">
                  Frontier Computer Science • Self-Adaptive • Neuro-Symbolic
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-6 h-6 text-yellow-400 animate-pulse" />
              <span className="text-white font-semibold">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex space-x-2 overflow-x-auto py-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold
                    transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? `bg-gradient-to-r ${tab.color} text-white shadow-lg scale-105`
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'chat' && <ClaudeChat />}
        {activeTab === 'genetic' && <GeneticAlgorithm />}
        {activeTab === 'constraint' && <ConstraintSolver />}
        {activeTab === 'neuro' && <NeuroSymbolic />}
        {activeTab === 'dashboard' && <SystemDashboard />}
      </div>

      {/* Footer */}
      <footer className="mt-16 bg-black/30 backdrop-blur-lg border-t border-white/10 py-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
            <div>
              <h3 className="text-white font-bold mb-2">Technologies</h3>
              <p className="text-gray-400 text-sm">
                Next.js • React • PostgreSQL • Claude AI • RxJS
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Paradigms</h3>
              <p className="text-gray-400 text-sm">
                Genetic • Constraint • Reactive • Functional • Self-Adaptive
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Optimized For</h3>
              <p className="text-gray-400 text-sm">
                Samsung S25 Ultra • Mobile-First • PWA Ready
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
