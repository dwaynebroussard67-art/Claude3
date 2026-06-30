'use client';

import { useState } from 'react';
import { Dna, Play, Loader2, TrendingUp } from 'lucide-react';

interface EvolutionStep {
  generation: number;
  fitness: number;
  expression: string;
}

export function GeneticAlgorithm() {
  const [problemType, setProblemType] = useState('function-approximation');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<EvolutionStep[]>([]);

  const runEvolution = async () => {
    setRunning(true);
    setResult(null);
    setHistory([]);

    try {
      // Example: evolve a function that approximates x^2
      const config = {
        populationSize: 100,
        mutationRate: 0.15,
        crossoverRate: 0.7,
        maxGenerations: 50,
      };

      const targetFunction = {
        testCases: [
          { input: { x: 0 }, output: 0 },
          { input: { x: 1 }, output: 1 },
          { input: { x: 2 }, output: 4 },
          { input: { x: 3 }, output: 9 },
          { input: { x: 4 }, output: 16 },
          { input: { x: 5 }, output: 25 },
        ],
      };

      const res = await fetch('/api/genetic/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemType,
          problemDescription: 'Evolve a function that approximates f(x) = x^2',
          targetFunction,
          config,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.solution);
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Evolution failed:', error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Dna className="w-8 h-8 text-green-400" />
          <h2 className="text-2xl font-bold text-white">Genetic Programming Engine</h2>
        </div>
        <p className="text-gray-300">
          Evolve computer programs and mathematical expressions using evolutionary algorithms.
          The system uses natural selection, crossover, and mutation to discover optimal solutions.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Problem Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Problem Type</label>
            <select
              value={problemType}
              onChange={(e) => setProblemType(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="function-approximation">Function Approximation (x²)</option>
              <option value="symbolic-regression">Symbolic Regression</option>
              <option value="optimization">Optimization Problem</option>
            </select>
          </div>

          <button
            onClick={runEvolution}
            disabled={running}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl px-6 py-4 font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {running ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Evolving Solutions...</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                <span>Start Evolution</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <span>Evolution Results</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Generations</div>
              <div className="text-white text-2xl font-bold">{result.generation}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Fitness Score</div>
              <div className="text-white text-2xl font-bold">
                {(result.fitness * 100).toFixed(2)}%
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Solution ID</div>
              <div className="text-white text-2xl font-bold">#{result.id}</div>
            </div>
          </div>

          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <div className="text-green-400 text-sm font-semibold mb-2">Evolved Expression</div>
            <div className="text-white text-lg font-mono">{result.expression}</div>
          </div>
        </div>
      )}

      {/* Evolution History */}
      {history.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Evolution Progress</h3>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.filter((_, i) => i % 5 === 0 || i === history.length - 1).map((step, index) => (
              <div
                key={index}
                className="bg-white/10 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-gray-400 text-sm">Gen {step.generation}</div>
                  <div className="text-white font-mono text-sm truncate max-w-md">
                    {step.expression}
                  </div>
                </div>
                <div className="text-green-400 font-semibold">
                  {(step.fitness * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
