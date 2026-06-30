'use client';

import { useState } from 'react';
import { Network, Play, Loader2, CheckCircle2 } from 'lucide-react';

export function ConstraintSolver() {
  const [problemType, setProblemType] = useState('sudoku');
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const solveProblem = async () => {
    setSolving(true);
    setResult(null);

    try {
      let problem;

      if (problemType === 'sudoku') {
        // Simple 4x4 Sudoku example (rows, columns, and 2x2 boxes all-different)
        problem = {
          variables: [
            { name: 'A1', domain: [1, 2, 3, 4] },
            { name: 'A2', domain: [1, 2, 3, 4] },
            { name: 'A3', domain: [1, 2, 3, 4] },
            { name: 'A4', domain: [1, 2, 3, 4] },
            { name: 'B1', domain: [1, 2, 3, 4] },
            { name: 'B2', domain: [1, 2, 3, 4] },
            { name: 'B3', domain: [1, 2, 3, 4] },
            { name: 'B4', domain: [1, 2, 3, 4] },
            { name: 'C1', domain: [1, 2, 3, 4] },
            { name: 'C2', domain: [1, 2, 3, 4] },
            { name: 'C3', domain: [1, 2, 3, 4] },
            { name: 'C4', domain: [1, 2, 3, 4] },
            { name: 'D1', domain: [1, 2, 3, 4] },
            { name: 'D2', domain: [1, 2, 3, 4] },
            { name: 'D3', domain: [1, 2, 3, 4] },
            { name: 'D4', domain: [1, 2, 3, 4] },
          ],
          constraints: [
            // Rows
            { kind: 'allDifferent', variables: ['A1', 'A2', 'A3', 'A4'] },
            { kind: 'allDifferent', variables: ['B1', 'B2', 'B3', 'B4'] },
            { kind: 'allDifferent', variables: ['C1', 'C2', 'C3', 'C4'] },
            { kind: 'allDifferent', variables: ['D1', 'D2', 'D3', 'D4'] },
            // Columns
            { kind: 'allDifferent', variables: ['A1', 'B1', 'C1', 'D1'] },
            { kind: 'allDifferent', variables: ['A2', 'B2', 'C2', 'D2'] },
            { kind: 'allDifferent', variables: ['A3', 'B3', 'C3', 'D3'] },
            { kind: 'allDifferent', variables: ['A4', 'B4', 'C4', 'D4'] },
            // 2x2 boxes
            { kind: 'allDifferent', variables: ['A1', 'A2', 'B1', 'B2'] },
            { kind: 'allDifferent', variables: ['A3', 'A4', 'B3', 'B4'] },
            { kind: 'allDifferent', variables: ['C1', 'C2', 'D1', 'D2'] },
            { kind: 'allDifferent', variables: ['C3', 'C4', 'D3', 'D4'] },
          ],
        };
      } else if (problemType === 'nqueens') {
        // 4-Queens: Qi = column of the queen in row i. allDifferent enforces
        // distinct columns (one classic N-Queens constraint). Full diagonal
        // safety would need a dedicated constraint kind not implemented in
        // this minimal demo solver.
        const rows = ['Q1', 'Q2', 'Q3', 'Q4'];
        problem = {
          variables: rows.map((name) => ({ name, domain: [1, 2, 3, 4] })),
          constraints: [{ kind: 'allDifferent', variables: rows }],
        };
      } else {
        // Graph coloring
        problem = {
          variables: [
            { name: 'Node1', domain: [1, 2, 3] }, // Colors: 1=Red, 2=Green, 3=Blue
            { name: 'Node2', domain: [1, 2, 3] },
            { name: 'Node3', domain: [1, 2, 3] },
            { name: 'Node4', domain: [1, 2, 3] },
          ],
          constraints: [
            { kind: 'notEquals', variables: ['Node1', 'Node2'] },
            { kind: 'notEquals', variables: ['Node2', 'Node3'] },
            { kind: 'notEquals', variables: ['Node3', 'Node4'] },
            { kind: 'notEquals', variables: ['Node4', 'Node1'] },
          ],
        };
      }

      const res = await fetch('/api/constraint/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: problemType,
          description: `Solving ${problemType} problem`,
          problem,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Solving failed:', error);
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Network className="w-8 h-8 text-purple-400" />
          <h2 className="text-2xl font-bold text-white">Constraint Satisfaction Solver</h2>
        </div>
        <p className="text-gray-300">
          Solve complex constraint satisfaction problems using backtracking with intelligent
          heuristics (MRV, LCV) and constraint propagation techniques.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Problem Selection</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Problem Type</label>
            <select
              value={problemType}
              onChange={(e) => setProblemType(e.target.value)}
              className="w-full bg-white/10 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="sudoku">Sudoku (4x4)</option>
              <option value="nqueens">N-Queens (4x4)</option>
              <option value="graph-coloring">Graph Coloring</option>
            </select>
          </div>

          <button
            onClick={solveProblem}
            disabled={solving}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl px-6 py-4 font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {solving ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Solving...</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6" />
                <span>Solve Problem</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <span>Solution Found</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Backtrack Count</div>
              <div className="text-white text-2xl font-bold">{result.backtrackCount}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Time (ms)</div>
              <div className="text-white text-2xl font-bold">{result.timeMs}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Status</div>
              <div className="text-green-400 text-2xl font-bold">
                {result.success ? 'Solved' : 'No Solution'}
              </div>
            </div>
          </div>

          {result.solution && (
            <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
              <div className="text-purple-400 text-sm font-semibold mb-2">Variable Assignment</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(result.solution).map(([variable, value]) => (
                  <div key={variable} className="bg-white/10 rounded p-2 text-center">
                    <div className="text-gray-400 text-xs">{variable}</div>
                    <div className="text-white text-lg font-bold">{value as number}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
