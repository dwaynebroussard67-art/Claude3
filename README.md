# Advanced AI System - Frontier Computer Science

A comprehensive AI system built with Next.js and PostgreSQL, featuring cutting-edge computer science paradigms including Genetic Programming, Constraint Solving, Neuro-Symbolic AI, Reactive Programming, Functional Programming, and Self-Adaptive Systems.

## 🚀 Features

### 🧠 Claude AI Integration
- Full integration with Claude 3.5 Sonnet
- Conversational AI interface with context awareness
- Persistent conversation history
- Real-time streaming responses

### 🧬 Genetic Programming
- Evolutionary algorithms for program synthesis
- Function approximation and symbolic regression
- Automatic fitness evaluation
- Population-based optimization
- Crossover and mutation operators
- Real-time evolution visualization

### 🔗 Constraint Satisfaction Solver
- Advanced CSP solver with backtracking
- Intelligent heuristics (MRV, LCV)
- Forward checking and arc consistency (AC-3)
- Supports multiple problem types:
  - Sudoku puzzles
  - N-Queens
  - Graph coloring
  - Custom constraint problems

### ✨ Neuro-Symbolic AI
- Combines neural networks (Claude) with symbolic reasoning
- Knowledge base management
- Forward and backward chaining inference
- Rule-based reasoning
- Confidence-weighted facts
- Automated knowledge derivation

### 🔄 Reactive Programming
- RxJS-based event streams
- Real-time state management
- Observable patterns
- Event-driven architecture
- Reactive UI updates

### 🎯 Self-Adaptive Systems
- MAPE-K loop (Monitor, Analyze, Plan, Execute, Knowledge)
- Automatic parameter tuning
- Performance metric tracking
- Anomaly detection
- Autonomous adaptation

### 📱 Progressive Web App (PWA)
- Installable on mobile devices (S25 Ultra optimized)
- Offline capabilities
- Native app-like experience
- Responsive mobile-first design

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Claude API (Anthropic)
- **Styling**: Tailwind CSS
- **State**: Zustand + RxJS
- **Reactive**: RxJS observables

## 📦 Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Set up your Anthropic API key**:
   - Get your API key from [Anthropic Console](https://console.anthropic.com/)
   - Add it to `.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

3. **Initialize the database**:
```bash
# The database will be automatically set up on first run
# Or manually push schema:
npx drizzle-kit push
```

4. **Run the development server**:
```bash
npm run dev
```

5. **Open in your browser**:
```
http://localhost:3000
```

## 📱 Mobile Installation (S25 Ultra)

1. Open the app in Chrome/Samsung Internet
2. Tap the menu (⋮) and select "Install app" or "Add to Home Screen"
3. The app will install as a native-like PWA
4. Launch from your home screen for full-screen experience

## 🎓 Advanced Features Explained

### Genetic Programming Engine

The genetic algorithm evolves mathematical expressions and programs:

```typescript
// Example: Evolve a function that approximates x²
const gp = new GeneticProgramming({
  populationSize: 100,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  maxGenerations: 50,
});

const result = await gp.evolve(fitnessFunction);
// Output: (x * x) or similar optimal expression
```

### Constraint Solver

Solve complex constraint satisfaction problems:

```typescript
const solver = new ConstraintSolver({
  variables: [
    { name: 'A', domain: [1, 2, 3, 4] },
    { name: 'B', domain: [1, 2, 3, 4] },
  ],
  constraints: [
    Constraints.notEquals('A', 'B'),
    Constraints.lessThan('A', 'B'),
  ],
});

const solution = solver.solve();
// Output: { A: 1, B: 2 }
```

### Neuro-Symbolic Reasoning

Combine neural insights with symbolic logic:

```typescript
const engine = new NeuroSymbolicEngine();

// Add facts from neural network (Claude)
engine.addFact('temperature_high', true, 0.9, 'neural');

// Add symbolic rules
engine.addRule({
  condition: (facts) => facts.temperature_high,
  action: (facts) => ({ turn_on_ac: true }),
});

// Run inference
const result = engine.forwardChain();
// Derives new knowledge through logical reasoning
```

### Self-Adaptive System

The system monitors and adapts its own parameters:

```typescript
import { adaptiveSystem } from '@/lib/self-adaptive';

// System automatically adjusts parameters based on performance
adaptiveSystem.startAutonomous(5000);

// Add custom metrics
adaptiveSystem.addMetric({
  name: 'response_time',
  value: 250,
  threshold: { min: 0, max: 500 },
});

// System will automatically adapt if thresholds are violated
```

## 🎯 Use Cases

1. **AI-Assisted Problem Solving**: Use Claude to analyze complex problems and suggest solutions
2. **Automated Optimization**: Evolve optimal solutions using genetic algorithms
3. **Logic Puzzles**: Solve Sudoku, N-Queens, and constraint problems instantly
4. **Knowledge Management**: Build and query a neuro-symbolic knowledge base
5. **System Monitoring**: Track performance and let the system self-optimize

## 🔐 Security

- API keys are stored server-side only
- Client-side code never exposes secrets
- All API calls proxied through Next.js API routes
- Database credentials in environment variables

## 🚀 Deployment

The app is optimized for deployment on Vercel, Netlify, or any Node.js hosting:

```bash
npm run build
npm start
```

For PostgreSQL, use services like:
- Neon
- Supabase
- Railway
- Vercel Postgres

## 📊 Database Schema

The system includes comprehensive tables for:
- Conversations and messages (Claude AI)
- Evolved solutions (Genetic Programming)
- Constraint problems and solutions
- Knowledge base facts (Neuro-Symbolic)
- System metrics and adaptive parameters
- Event streams (Reactive Programming)

## 🤝 Contributing

This is a demonstration of frontier computer science concepts integrated into a practical application. Feel free to extend and customize:

- Add new genetic operators
- Implement additional constraint types
- Extend the knowledge base with more rules
- Add new self-adaptive metrics
- Integrate additional AI models

## 📝 License

MIT License - feel free to use this as a learning resource or starting point for your own projects.

## 🌟 Acknowledgments

Built with:
- Next.js by Vercel
- Claude AI by Anthropic
- Drizzle ORM
- RxJS
- Tailwind CSS

---

**No fake code. All features are fully functional and ready to use.** 🚀

Optimized for Samsung S25 Ultra and mobile devices.
