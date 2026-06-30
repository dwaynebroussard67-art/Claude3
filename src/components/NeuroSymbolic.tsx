'use client';

import { useState } from 'react';
import { Sparkles, Brain, Code, Plus } from 'lucide-react';

interface Fact {
  key: string;
  value: any;
  confidence: number;
  source: 'neural' | 'symbolic' | 'user';
}

export function NeuroSymbolic() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [newFactKey, setNewFactKey] = useState('');
  const [newFactValue, setNewFactValue] = useState('');
  const [inference, setInference] = useState<string>('');

  const [loading, setLoading] = useState(false);

  const addFact = () => {
    if (!newFactKey.trim() || !newFactValue.trim()) return;

    const newFact: Fact = {
      key: newFactKey,
      value: newFactValue === 'true' || newFactValue === 'false' 
        ? newFactValue === 'true' 
        : newFactValue,
      confidence: 1.0,
      source: 'user',
    };

    setFacts([...facts, newFact]);
    setNewFactKey('');
    setNewFactValue('');
  };

  const runInference = async () => {
    setLoading(true);
    setInference('');
    try {
      // Calls the real server-side NeuroSymbolicEngine (forward chaining
      // over transitivity / AND / OR rules), not a client-side simulation.
      const res = await fetch('/api/neuro/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts: facts.map((f) => ({ key: f.key, value: f.value, confidence: f.confidence })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setInference(data.error || 'Inference failed.');
        return;
      }

      const existingKeys = new Set(facts.map((f) => f.key));
      const derived: Fact[] = (data.facts || [])
        .filter((f: any) => !existingKeys.has(f.key))
        .map((f: any) => ({
          key: f.key,
          value: f.value,
          confidence: f.confidence,
          source: f.source === 'user' ? 'symbolic' : f.source,
        }));

      if (derived.length > 0) {
        setFacts([...facts, ...derived]);
        setInference(
          `Derived ${derived.length} new fact(s) via rules: ${data.rulesApplied.join(', ') || 'n/a'}`
        );
      } else {
        setInference('No new facts could be inferred from current knowledge base.');
      }
    } catch (error) {
      console.error('Inference request failed:', error);
      setInference('Inference request failed.');
    } finally {
      setLoading(false);
      setTimeout(() => setInference(''), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Sparkles className="w-8 h-8 text-orange-400" />
          <h2 className="text-2xl font-bold text-white">Neuro-Symbolic AI Engine</h2>
        </div>
        <p className="text-gray-300">
          Combines neural network capabilities (Claude) with symbolic reasoning and logic.
          Build a knowledge base with facts and rules, then use both neural insights and
          logical inference to derive new knowledge.
        </p>
      </div>

      {/* Add Facts */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
          <Plus className="w-6 h-6" />
          <span>Add Facts to Knowledge Base</span>
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Fact Key</label>
              <input
                type="text"
                value={newFactKey}
                onChange={(e) => setNewFactKey(e.target.value)}
                placeholder="e.g., A_greater_than_B"
                className="w-full bg-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Value</label>
              <input
                type="text"
                value={newFactValue}
                onChange={(e) => setNewFactValue(e.target.value)}
                placeholder="true, false, or any value"
                className="w-full bg-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <button
            onClick={addFact}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl px-6 py-3 font-bold hover:shadow-lg transition-all"
          >
            Add Fact
          </button>
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Brain className="w-6 h-6 text-orange-400" />
            <span>Knowledge Base ({facts.length} facts)</span>
          </h3>
          <button
            onClick={runInference}
            disabled={facts.length === 0 || loading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg px-6 py-2 font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running…' : 'Run Inference'}
          </button>
        </div>

        {inference && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-400">
            {inference}
          </div>
        )}

        {facts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No facts in knowledge base yet. Add some facts to begin!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {facts.map((fact, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 ${
                  fact.source === 'user'
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : fact.source === 'symbolic'
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'bg-orange-500/20 border border-orange-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-mono font-semibold">{fact.key}</div>
                    <div className="text-gray-300 text-sm">
                      = {JSON.stringify(fact.value)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase">{fact.source}</div>
                    <div className="text-sm text-white font-semibold">
                      {(fact.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Example Patterns */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Example Patterns</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-orange-400 font-semibold mb-2">Transitivity</div>
            <div className="text-gray-300 text-sm">
              <code>A_greater_than_B</code> + <code>B_greater_than_C</code>
              <br />→ <code>A_greater_than_C</code>
            </div>
          </div>
          
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-orange-400 font-semibold mb-2">Logical AND</div>
            <div className="text-gray-300 text-sm">
              <code>condition_A</code> + <code>condition_B</code>
              <br />→ <code>condition_A_and_condition_B</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
