// Genetic Programming Engine - Evolves solutions to problems

export interface Gene {
  type: 'operation' | 'value' | 'variable';
  value: string | number;
  children?: Gene[];
}

export interface Individual {
  id: string;
  genome: Gene;
  fitness: number;
  generation: number;
}

export interface GeneticConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismRate: number;
  maxGenerations: number;
  tournamentSize: number;
}

const DEFAULT_CONFIG: GeneticConfig = {
  populationSize: 50,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  elitismRate: 0.1,
  maxGenerations: 100,
  tournamentSize: 5,
};

// Available operations for genetic programs
const OPERATIONS = ['+', '-', '*', '/', 'max', 'min', 'abs', 'sqrt', 'pow'];
const VARIABLES = ['x', 'y', 'z', 'a', 'b'];

export class GeneticProgramming {
  private config: GeneticConfig;
  private population: Individual[] = [];
  private generation: number = 0;
  private bestIndividual: Individual | null = null;

  constructor(config: Partial<GeneticConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Generate random gene tree
  private generateRandomGene(depth: number = 0, maxDepth: number = 4): Gene {
    if (depth >= maxDepth || Math.random() < 0.3) {
      // Terminal node - value or variable
      if (Math.random() < 0.5) {
        return {
          type: 'value',
          value: Math.random() * 10 - 5, // Random value between -5 and 5
        };
      } else {
        return {
          type: 'variable',
          value: VARIABLES[Math.floor(Math.random() * VARIABLES.length)],
        };
      }
    } else {
      // Operation node
      const operation = OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
      const arity = ['abs', 'sqrt'].includes(operation) ? 1 : 2;
      
      return {
        type: 'operation',
        value: operation,
        children: Array.from({ length: arity }, () => 
          this.generateRandomGene(depth + 1, maxDepth)
        ),
      };
    }
  }

  // Initialize population
  initializePopulation(): void {
    this.population = Array.from({ length: this.config.populationSize }, (_, i) => ({
      id: `gen0_ind${i}`,
      genome: this.generateRandomGene(),
      fitness: 0,
      generation: 0,
    }));
  }

  // Evaluate a gene tree with given variables
  evaluateGene(gene: Gene, variables: Record<string, number>): number {
    if (gene.type === 'value') {
      return gene.value as number;
    }
    
    if (gene.type === 'variable') {
      return variables[gene.value as string] || 0;
    }
    
    if (gene.type === 'operation' && gene.children) {
      const values = gene.children.map(child => this.evaluateGene(child, variables));
      
      switch (gene.value) {
        case '+': return values[0] + values[1];
        case '-': return values[0] - values[1];
        case '*': return values[0] * values[1];
        case '/': return values[1] !== 0 ? values[0] / values[1] : 0;
        case 'max': return Math.max(values[0], values[1]);
        case 'min': return Math.min(values[0], values[1]);
        case 'abs': return Math.abs(values[0]);
        case 'sqrt': return Math.sqrt(Math.abs(values[0]));
        case 'pow': return Math.pow(values[0], Math.min(values[1], 3)); // Limit power
        default: return 0;
      }
    }
    
    return 0;
  }

  // Evaluate fitness of an individual
  evaluateFitness(individual: Individual, fitnessFunction: (evaluate: (vars: Record<string, number>) => number) => number): void {
    individual.fitness = fitnessFunction((vars) => this.evaluateGene(individual.genome, vars));
  }

  // Tournament selection
  private tournamentSelect(): Individual {
    const tournament: Individual[] = [];
    for (let i = 0; i < this.config.tournamentSize; i++) {
      tournament.push(this.population[Math.floor(Math.random() * this.population.length)]);
    }
    return tournament.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
  }

  // Crossover two parents
  private crossover(parent1: Individual, parent2: Individual): Gene {
    if (Math.random() > this.config.crossoverRate) {
      return JSON.parse(JSON.stringify(parent1.genome)); // Deep copy
    }

    const p1Copy = JSON.parse(JSON.stringify(parent1.genome));
    const p2Copy = JSON.parse(JSON.stringify(parent2.genome));

    // Get random subtrees
    const p1Subtree = this.getRandomSubtree(p1Copy);
    const p2Subtree = this.getRandomSubtree(p2Copy);

    // Swap them
    Object.assign(p1Subtree, p2Subtree);
    
    return p1Copy;
  }

  // Mutate a gene tree
  private mutate(gene: Gene): Gene {
    const copy = JSON.parse(JSON.stringify(gene));
    
    if (Math.random() < this.config.mutationRate) {
      // Replace random subtree
      const subtree = this.getRandomSubtree(copy);
      const newSubtree = this.generateRandomGene();
      Object.assign(subtree, newSubtree);
    }
    
    return copy;
  }

  // Get random subtree from gene tree
  private getRandomSubtree(gene: Gene): Gene {
    const allNodes: Gene[] = [];
    const collectNodes = (node: Gene) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };
    collectNodes(gene);
    
    return allNodes[Math.floor(Math.random() * allNodes.length)];
  }

  // Evolve one generation
  evolveGeneration(fitnessFunction: (evaluate: (vars: Record<string, number>) => number) => number): void {
    // Evaluate fitness
    this.population.forEach(ind => this.evaluateFitness(ind, fitnessFunction));

    // Sort by fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Track best
    if (!this.bestIndividual || this.population[0].fitness > this.bestIndividual.fitness) {
      this.bestIndividual = { ...this.population[0] };
    }

    // Create new population
    const eliteCount = Math.floor(this.config.populationSize * this.config.elitismRate);
    const newPopulation: Individual[] = [];

    // Elitism - keep best individuals
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push({ ...this.population[i], generation: this.generation + 1 });
    }

    // Create offspring
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.tournamentSelect();
      const parent2 = this.tournamentSelect();
      
      let offspring = this.crossover(parent1, parent2);
      offspring = this.mutate(offspring);
      
      newPopulation.push({
        id: `gen${this.generation + 1}_ind${newPopulation.length}`,
        genome: offspring,
        fitness: 0,
        generation: this.generation + 1,
      });
    }

    this.population = newPopulation;
    this.generation++;
  }

  // Run evolution
  async evolve(
    fitnessFunction: (evaluate: (vars: Record<string, number>) => number) => number,
    onProgress?: (generation: number, best: Individual) => void
  ): Promise<Individual> {
    this.initializePopulation();
    
    for (let i = 0; i < this.config.maxGenerations; i++) {
      this.evolveGeneration(fitnessFunction);
      
      if (onProgress && this.bestIndividual) {
        onProgress(this.generation, this.bestIndividual);
      }

      // Check for perfect solution
      if (this.bestIndividual && this.bestIndividual.fitness >= 0.9999) {
        break;
      }
    }

    return this.bestIndividual!;
  }

  // Convert gene to human-readable string
  geneToString(gene: Gene): string {
    if (gene.type === 'value') {
      return (gene.value as number).toFixed(2);
    }
    
    if (gene.type === 'variable') {
      return gene.value as string;
    }
    
    if (gene.type === 'operation' && gene.children) {
      const childStrings = gene.children.map(child => this.geneToString(child));
      
      if (['abs', 'sqrt'].includes(gene.value as string)) {
        return `${gene.value}(${childStrings[0]})`;
      }
      
      return `(${childStrings[0]} ${gene.value} ${childStrings[1]})`;
    }
    
    return '';
  }

  getBest(): Individual | null {
    return this.bestIndividual;
  }

  getPopulation(): Individual[] {
    return this.population;
  }

  getGeneration(): number {
    return this.generation;
  }
}
