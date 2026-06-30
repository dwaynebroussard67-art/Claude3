'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Zap, CheckCircle } from 'lucide-react';

export function GettingStarted() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenGettingStarted');
    if (!hasSeenGuide) {
      setShow(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenGettingStarted', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-8 h-8 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">Getting Started</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Setup */}
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Zap className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-yellow-400 font-bold mb-2">Quick Setup Required</h3>
                <p className="text-white text-sm mb-2">
                  To use the AI chat features, add a free Hugging Face token:
                </p>
                <ol className="text-white text-sm space-y-1 list-decimal list-inside">
                  <li>Get a free token from <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">huggingface.co/settings/tokens</a> (a &quot;Read&quot; token is enough, no card required)</li>
                  <li>Add it to your <code className="bg-black/30 px-2 py-1 rounded">.env</code> file as <code className="bg-black/30 px-2 py-1 rounded">HF_TOKEN</code></li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Features Overview</h3>

            <div className="space-y-3">
              {[
                {
                  title: 'Claude AI Chat',
                  description: 'Conversational AI powered by Claude 3.5 Sonnet with full context awareness',
                  color: 'blue',
                },
                {
                  title: 'Genetic Programming',
                  description: 'Evolve mathematical expressions and programs using evolutionary algorithms',
                  color: 'green',
                },
                {
                  title: 'Constraint Solver',
                  description: 'Solve complex CSP problems like Sudoku, N-Queens, and graph coloring',
                  color: 'purple',
                },
                {
                  title: 'Neuro-Symbolic AI',
                  description: 'Combine neural networks with symbolic reasoning and logic',
                  color: 'orange',
                },
                {
                  title: 'System Dashboard',
                  description: 'Monitor performance, metrics, and self-adaptive parameters in real-time',
                  color: 'indigo',
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/10 rounded-lg p-4 flex items-start space-x-3"
                >
                  <CheckCircle className={`w-5 h-5 text-${feature.color}-400 flex-shrink-0 mt-1`} />
                  <div>
                    <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                    <p className="text-gray-300 text-sm">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PWA Info */}
          <div className="mt-6 bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
            <h3 className="text-purple-400 font-bold mb-2">📱 Install as App</h3>
            <p className="text-white text-sm">
              This is a Progressive Web App! Install it on your S25 Ultra for a native app experience:
            </p>
            <ul className="text-white text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Tap browser menu (⋮) → "Install app"</li>
              <li>Launch from home screen</li>
              <li>Works offline once cached</li>
            </ul>
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl px-6 py-3 font-bold hover:shadow-lg transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
