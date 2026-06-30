// Pre-configured examples for each AI paradigm

export const geneticExamples = {
  squareFunction: {
    name: 'Square Function (x²)',
    description: 'Evolve a function that approximates f(x) = x²',
    testCases: [
      { input: { x: 0 }, output: 0 },
      { input: { x: 1 }, output: 1 },
      { input: { x: 2 }, output: 4 },
      { input: { x: 3 }, output: 9 },
      { input: { x: 4 }, output: 16 },
      { input: { x: 5 }, output: 25 },
    ],
    config: {
      populationSize: 100,
      mutationRate: 0.15,
      crossoverRate: 0.7,
      maxGenerations: 50,
    },
  },
  
  cubeFunction: {
    name: 'Cube Function (x³)',
    description: 'Evolve a function that approximates f(x) = x³',
    testCases: [
      { input: { x: 0 }, output: 0 },
      { input: { x: 1 }, output: 1 },
      { input: { x: 2 }, output: 8 },
      { input: { x: 3 }, output: 27 },
      { input: { x: 4 }, output: 64 },
    ],
    config: {
      populationSize: 150,
      mutationRate: 0.2,
      crossoverRate: 0.7,
      maxGenerations: 100,
    },
  },

  pythagorean: {
    name: 'Pythagorean Theorem',
    description: 'Evolve a function that computes sqrt(x² + y²)',
    testCases: [
      { input: { x: 3, y: 4 }, output: 5 },
      { input: { x: 5, y: 12 }, output: 13 },
      { input: { x: 8, y: 15 }, output: 17 },
      { input: { x: 7, y: 24 }, output: 25 },
    ],
    config: {
      populationSize: 200,
      mutationRate: 0.15,
      crossoverRate: 0.8,
      maxGenerations: 100,
    },
  },
};

export const constraintExamples = {
  sudoku4x4: {
    name: '4x4 Sudoku',
    description: 'Simple 4x4 Sudoku puzzle',
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
      // All different in rows
      { type: 'global', variables: ['A1', 'A2', 'A3', 'A4'], description: 'Row A all different' },
      { type: 'global', variables: ['B1', 'B2', 'B3', 'B4'], description: 'Row B all different' },
      { type: 'global', variables: ['C1', 'C2', 'C3', 'C4'], description: 'Row C all different' },
      { type: 'global', variables: ['D1', 'D2', 'D3', 'D4'], description: 'Row D all different' },
      // All different in columns
      { type: 'global', variables: ['A1', 'B1', 'C1', 'D1'], description: 'Column 1 all different' },
      { type: 'global', variables: ['A2', 'B2', 'C2', 'D2'], description: 'Column 2 all different' },
      { type: 'global', variables: ['A3', 'B3', 'C3', 'D3'], description: 'Column 3 all different' },
      { type: 'global', variables: ['A4', 'B4', 'C4', 'D4'], description: 'Column 4 all different' },
    ],
  },

  nQueens: {
    name: '4-Queens Problem',
    description: 'Place 4 queens on a 4x4 board',
    variables: [
      { name: 'Q1', domain: [1, 2, 3, 4] },
      { name: 'Q2', domain: [1, 2, 3, 4] },
      { name: 'Q3', domain: [1, 2, 3, 4] },
      { name: 'Q4', domain: [1, 2, 3, 4] },
    ],
    constraints: [
      { type: 'global', variables: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'All queens in different rows' },
    ],
  },

  graphColoring: {
    name: 'Graph Coloring',
    description: 'Color a simple graph with 3 colors',
    variables: [
      { name: 'Node1', domain: [1, 2, 3] },
      { name: 'Node2', domain: [1, 2, 3] },
      { name: 'Node3', domain: [1, 2, 3] },
      { name: 'Node4', domain: [1, 2, 3] },
      { name: 'Node5', domain: [1, 2, 3] },
    ],
    constraints: [
      { type: 'binary', variables: ['Node1', 'Node2'], description: 'Adjacent nodes different colors' },
      { type: 'binary', variables: ['Node1', 'Node3'], description: 'Adjacent nodes different colors' },
      { type: 'binary', variables: ['Node2', 'Node3'], description: 'Adjacent nodes different colors' },
      { type: 'binary', variables: ['Node2', 'Node4'], description: 'Adjacent nodes different colors' },
      { type: 'binary', variables: ['Node3', 'Node5'], description: 'Adjacent nodes different colors' },
    ],
  },
};

export const neuroSymbolicExamples = {
  transitivity: [
    { key: 'A_greater_than_B', value: true },
    { key: 'B_greater_than_C', value: true },
    { key: 'C_greater_than_D', value: true },
  ],

  temperature: [
    { key: 'temperature', value: 85 },
    { key: 'humidity', value: 60 },
    { key: 'temperature_high', value: true },
    { key: 'humidity_high', value: true },
  ],

  logic: [
    { key: 'is_raining', value: true },
    { key: 'is_cold', value: true },
    { key: 'has_umbrella', value: false },
  ],
};

export const claudePrompts = {
  explainGA: 'Explain how genetic algorithms work and give me a simple example of evolving a mathematical expression.',
  
  solveCSP: 'I need help understanding constraint satisfaction problems. Can you explain the N-Queens problem and how to solve it?',
  
  neuroSymbolic: 'What is neuro-symbolic AI and how does it combine neural networks with symbolic reasoning? Give me a practical example.',
  
  selfAdaptive: 'Explain self-adaptive systems and the MAPE-K loop. How can a system monitor and improve itself autonomously?',
  
  reactiveStreams: 'What is reactive programming and how do reactive streams work? Compare it to traditional imperative programming.',
};
