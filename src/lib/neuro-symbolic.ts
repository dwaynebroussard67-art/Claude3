// Neuro-Symbolic AI - Combines neural (Claude) with symbolic reasoning

export interface SymbolicRule {
  id: string;
  condition: (facts: Record<string, any>) => boolean;
  action: (facts: Record<string, any>) => Record<string, any>;
  confidence: number;
  description: string;
}

export interface Fact {
  key: string;
  value: any;
  confidence: number;
  source: 'neural' | 'symbolic' | 'user';
  derivedFrom?: string[];
}

export interface InferenceResult {
  facts: Fact[];
  rulesApplied: string[];
  neuralInsights: string[];
  confidence: number;
}

export class NeuroSymbolicEngine {
  private facts: Map<string, Fact> = new Map();
  private rules: SymbolicRule[] = [];
  private inferenceHistory: InferenceResult[] = [];

  constructor() {
    this.initializeBaseRules();
  }

  // Initialize base logical rules
  private initializeBaseRules(): void {
    this.rules = [
      // Transitivity rule
      {
        id: 'transitivity',
        description: 'If A > B and B > C, then A > C',
        confidence: 1.0,
        condition: (facts) => {
          const comparisons: Array<[string, string, string]> = [];
          for (const [key, fact] of Object.entries(facts)) {
            const match = key.match(/(.+)_greater_than_(.+)/);
            if (match && fact.value === true) {
              comparisons.push([match[1], match[2], key]);
            }
          }
          
          for (let i = 0; i < comparisons.length; i++) {
            for (let j = 0; j < comparisons.length; j++) {
              if (i !== j && comparisons[i][1] === comparisons[j][0]) {
                const newKey = `${comparisons[i][0]}_greater_than_${comparisons[j][1]}`;
                if (!facts[newKey]) {
                  return true;
                }
              }
            }
          }
          return false;
        },
        action: (facts) => {
          const comparisons: Array<[string, string]> = [];
          for (const [key, fact] of Object.entries(facts)) {
            const match = key.match(/(.+)_greater_than_(.+)/);
            if (match && fact.value === true) {
              comparisons.push([match[1], match[2]]);
            }
          }
          
          const newFacts: Record<string, any> = {};
          for (let i = 0; i < comparisons.length; i++) {
            for (let j = 0; j < comparisons.length; j++) {
              if (i !== j && comparisons[i][1] === comparisons[j][0]) {
                const newKey = `${comparisons[i][0]}_greater_than_${comparisons[j][1]}`;
                if (!facts[newKey]) {
                  newFacts[newKey] = {
                    value: true,
                    confidence: Math.min(facts[`${comparisons[i][0]}_greater_than_${comparisons[i][1]}`]?.confidence || 1, 
                                        facts[`${comparisons[j][0]}_greater_than_${comparisons[j][1]}`]?.confidence || 1),
                  };
                }
              }
            }
          }
          return newFacts;
        },
      },
      
      // Logical AND rule
      {
        id: 'logical_and',
        description: 'Combine conditions with AND logic',
        confidence: 1.0,
        condition: (facts) => {
          for (const key of Object.keys(facts)) {
            const match = key.match(/(.+)_and_(.+)/);
            if (match) {
              const [, a, b] = match;
              if (facts[a]?.value && facts[b]?.value && !facts[key]?.value) {
                return true;
              }
            }
          }
          return false;
        },
        action: (facts) => {
          const newFacts: Record<string, any> = {};
          for (const key of Object.keys(facts)) {
            const match = key.match(/(.+)_and_(.+)/);
            if (match) {
              const [, a, b] = match;
              if (facts[a]?.value && facts[b]?.value && !facts[key]?.value) {
                newFacts[key] = {
                  value: facts[a].value && facts[b].value,
                  confidence: Math.min(facts[a].confidence, facts[b].confidence),
                };
              }
            }
          }
          return newFacts;
        },
      },
      
      // Negation rule
      {
        id: 'negation',
        description: 'NOT logic',
        confidence: 1.0,
        condition: (facts) => {
          for (const key of Object.keys(facts)) {
            const match = key.match(/not_(.+)/);
            if (match) {
              const [, a] = match;
              if (facts[a] !== undefined && facts[key] === undefined) {
                return true;
              }
            }
          }
          return false;
        },
        action: (facts) => {
          const newFacts: Record<string, any> = {};
          for (const key of Object.keys(facts)) {
            const match = key.match(/not_(.+)/);
            if (match) {
              const [, a] = match;
              if (facts[a] !== undefined && facts[key] === undefined) {
                newFacts[key] = {
                  value: !facts[a].value,
                  confidence: facts[a].confidence,
                };
              }
            }
          }
          return newFacts;
        },
      },
    ];
  }

  // Add a fact to the knowledge base
  addFact(key: string, value: any, confidence: number = 1.0, source: 'neural' | 'symbolic' | 'user' = 'user'): void {
    this.facts.set(key, {
      key,
      value,
      confidence,
      source,
    });
  }

  // Add a custom rule
  addRule(rule: SymbolicRule): void {
    this.rules.push(rule);
  }

  // Forward chaining inference
  forwardChain(maxIterations: number = 100): InferenceResult {
    const rulesApplied: string[] = [];
    let iteration = 0;
    let changed = true;

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      const factsObj = Object.fromEntries(this.facts);

      for (const rule of this.rules) {
        if (rule.condition(factsObj)) {
          const newFacts = rule.action(factsObj);
          
          for (const [key, factData] of Object.entries(newFacts)) {
            if (!this.facts.has(key)) {
              this.addFact(
                key,
                factData.value,
                factData.confidence * rule.confidence,
                'symbolic'
              );
              rulesApplied.push(rule.id);
              changed = true;
            }
          }
        }
      }
    }

    const result: InferenceResult = {
      facts: Array.from(this.facts.values()),
      rulesApplied,
      neuralInsights: [],
      confidence: this.calculateOverallConfidence(),
    };

    this.inferenceHistory.push(result);
    return result;
  }

  // Backward chaining to prove a goal
  backwardChain(goal: string, depth: number = 0, maxDepth: number = 10): boolean {
    if (depth > maxDepth) return false;

    // Check if goal is already a fact
    if (this.facts.has(goal)) {
      return this.facts.get(goal)!.confidence > 0.5;
    }

    // Try to prove goal using rules
    for (const rule of this.rules) {
      const factsObj = Object.fromEntries(this.facts);
      const newFacts = rule.action(factsObj);

      if (newFacts[goal]) {
        // This rule can derive the goal, check if condition is met
        if (rule.condition(factsObj)) {
          this.addFact(goal, newFacts[goal].value, newFacts[goal].confidence, 'symbolic');
          return true;
        }
      }
    }

    return false;
  }

  // Calculate overall confidence across all facts
  private calculateOverallConfidence(): number {
    if (this.facts.size === 0) return 0;
    
    const confidences = Array.from(this.facts.values()).map(f => f.confidence);
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  // Integrate neural insights (from Claude) with symbolic reasoning
  integrateNeuralInsights(insights: Array<{ key: string; value: any; confidence: number }>): void {
    for (const insight of insights) {
      this.addFact(insight.key, insight.value, insight.confidence, 'neural');
    }

    // Run inference to derive new facts
    this.forwardChain();
  }

  // Query the knowledge base
  query(pattern: string): Fact[] {
    const regex = new RegExp(pattern);
    return Array.from(this.facts.values()).filter(fact => regex.test(fact.key));
  }

  // Explain how a fact was derived
  explain(factKey: string): string {
    const fact = this.facts.get(factKey);
    if (!fact) return 'Fact not found';

    if (fact.source === 'user') {
      return `User provided: ${factKey} = ${fact.value}`;
    }

    if (fact.source === 'neural') {
      return `Neural network inferred: ${factKey} = ${fact.value} (confidence: ${fact.confidence.toFixed(2)})`;
    }

    // Symbolic derivation - trace back through inference history
    return `Derived symbolically: ${factKey} = ${fact.value} (confidence: ${fact.confidence.toFixed(2)})`;
  }

  // Get all facts
  getAllFacts(): Fact[] {
    return Array.from(this.facts.values());
  }

  // Clear all facts
  clearFacts(): void {
    this.facts.clear();
    this.inferenceHistory = [];
  }

  // Get inference history
  getHistory(): InferenceResult[] {
    return this.inferenceHistory;
  }

  // Resolve conflicts between neural and symbolic facts
  resolveConflicts(): void {
    const conflictGroups = new Map<string, Fact[]>();

    // Group facts by key
    for (const fact of this.facts.values()) {
      if (!conflictGroups.has(fact.key)) {
        conflictGroups.set(fact.key, []);
      }
      conflictGroups.get(fact.key)!.push(fact);
    }

    // Resolve conflicts by choosing highest confidence
    for (const [key, facts] of conflictGroups) {
      if (facts.length > 1) {
        const best = facts.reduce((a, b) => a.confidence > b.confidence ? a : b);
        this.facts.set(key, best);
      }
    }
  }
}

// Helper function to create rules from natural language (to be enhanced with Claude)
export function createRuleFromDescription(description: string): SymbolicRule | null {
  // Simple pattern matching for common rule types
  // In production, this would use Claude to parse natural language
  
  const ifThenMatch = description.match(/if (.+) then (.+)/i);
  if (ifThenMatch) {
    const [, condition, action] = ifThenMatch;
    
    return {
      id: `rule_${Date.now()}`,
      description,
      confidence: 0.8,
      condition: (facts) => {
        // Simple condition evaluation
        return Object.keys(facts).some(key => condition.toLowerCase().includes(key.toLowerCase()));
      },
      action: (facts) => {
        // Simple action
        return {};
      },
    };
  }

  return null;
}
